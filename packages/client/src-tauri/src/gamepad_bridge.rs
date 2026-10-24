//! Native gamepads on Linux, pushed to the page as `mc-gamepad` events.
//!
//! WebKitGTK's Gamepad API misreads common pads (an 8BitDo Ultimate 2 in Xbox mode: a trigger resting at -1 shows as a
//! stick axis held down, the D-pad does nothing, and a press only registers while held). On Linux a background thread
//! reads pads through gilrs instead (evdev with SDL_GameControllerDB mappings, normalized axes, the D-pad as buttons)
//! and emits each pad's state in the W3C "standard" layout; the page shims `navigator.getGamepads()` from those events.
//! Windows and macOS keep the webview's own Gamepad API: there `gamepad_bridge_status` reports `enabled: false` and
//! nothing starts.
//!
//! The thread starts on the first `gamepad_bridge_status`, so the page should listen for `mc-gamepad` before calling
//! it (pads already plugged in are announced once, right after start). State is coalesced to at most one emit per pad
//! per `MIN_EMIT_INTERVAL_MS`; a press shorter than that still reaches the page through `downs`. Nothing here can
//! panic the app: a gilrs error (or a panic inside it) is logged and the thread stops. A thread that stops after a
//! successful start sends one last `{ "kind": "stopped" }`, and the page then gives the webview's own gamepads back
//! rather than keep a shim no pad feeds. Failures go to stderr too: the log plugin is only installed in debug builds.

use std::sync::atomic::AtomicU8;
use std::sync::atomic::Ordering::{AcqRel, Acquire};

use serde::Serialize;

/// The W3C standard mapping's button count: 0-3 face, 4-5 bumpers, 6-7 triggers, 8-9 select/start, 10-11 sticks,
/// 12-15 D-pad, 16 guide.
const BUTTONS: usize = 17;
const AXES: usize = 4;
/// Standard-mapping indices the analog triggers sit at; their `pressed` comes from the value.
const LEFT_TRIGGER: usize = 6;
const RIGHT_TRIGGER: usize = 7;
const DPAD_UP: usize = 12;
const DPAD_DOWN: usize = 13;
const DPAD_LEFT: usize = 14;
const DPAD_RIGHT: usize = 15;
/// A trigger (or a D-pad reported as an axis) counts as pressed past this.
const PRESS_THRESHOLD: f64 = 0.5;
/// At most one `state` emit per pad per this many ms (about 120 a second): every event lands on the webview's busy
/// main thread, and taps shorter than this survive in `downs`.
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
const MIN_EMIT_INTERVAL_MS: f64 = 8.0;
/// The thread's sleep between drains of gilrs's queue.
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
const POLL_SLEEP_MS: u64 = 3;
/// The Tauri event every webview receives.
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
const EVENT: &str = "mc-gamepad";

#[derive(Clone, Copy, Debug, Serialize)]
pub struct GamepadBridgeStatus {
  pub enabled: bool,
}

// ---------------------------------------------------------------------------------------------------------------
// Pure parts (compiled everywhere so they are tested on every platform)

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize)]
pub struct ButtonState {
  pub pressed: bool,
  pub value: f64,
}

/// One pad as the page sees it: `buttons` and `axes` in the standard mapping, Y positive = down.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct PadPayload {
  pub index: u32,
  pub id: String,
  pub connected: bool,
  pub buttons: [ButtonState; BUTTONS],
  pub axes: [f64; AXES],
  pub timestamp: f64,
  /// Buttons that went from up to down since the previous emit, even if released again since.
  pub downs: Vec<u32>,
}

#[derive(Clone, Debug, Serialize)]
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
pub struct BridgeEvent {
  /// "connected", "disconnected" or "state", each with a pad; "stopped" (the bridge thread ended) without one.
  pub kind: &'static str,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub pad: Option<PadPayload>,
}

/// The start handshake between the command, which waits a bounded time for gilrs, and the thread, which may finish
/// initialising after the command has given up. Exactly one side wins: a thread that starts late exits unpolled, and
/// a command that times out just as the thread starts still answers true.
#[derive(Debug, Default)]
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
pub struct Handshake(AtomicU8);

#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
impl Handshake {
  const PENDING: u8 = 0;
  const STARTED: u8 = 1;
  const ABANDONED: u8 = 2;

  pub const fn new() -> Self {
    Handshake(AtomicU8::new(Self::PENDING))
  }

  /// The thread has a working gilrs: true if it may run, false if the command already answered false.
  pub fn begin(&self) -> bool {
    self.0.compare_exchange(Self::PENDING, Self::STARTED, AcqRel, Acquire).is_ok()
  }

  /// The command stopped waiting: true if the thread had started anyway (so the bridge is on).
  pub fn give_up(&self) -> bool {
    self.0.compare_exchange(Self::PENDING, Self::ABANDONED, AcqRel, Acquire) == Err(Self::STARTED)
  }
}

/// The id string the client's pad-family detection reads, in the shape Chromium gives a standard-mapped pad.
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
pub fn pad_id(name: &str, vendor: Option<u16>, product: Option<u16>) -> String {
  format!(
    "{name} (STANDARD GAMEPAD Vendor: {:04x} Product: {:04x})",
    vendor.unwrap_or(0),
    product.unwrap_or(0)
  )
}

/// A pad's live state between emits, plus whether anything changed since the last one.
#[derive(Clone, Debug)]
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
pub struct PadState {
  pub index: u32,
  pub id: String,
  buttons: [ButtonState; BUTTONS],
  axes: [f64; AXES],
  downs: Vec<u32>,
  dirty: bool,
  /// Bridge time (ms) of the last emit for this pad.
  last_emit_ms: f64,
}

#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
impl PadState {
  pub fn new(index: u32, id: String) -> Self {
    PadState {
      index,
      id,
      buttons: [ButtonState::default(); BUTTONS],
      axes: [0.0; AXES],
      downs: Vec::new(),
      dirty: false,
      last_emit_ms: f64::NEG_INFINITY,
    }
  }

  fn set(&mut self, button: usize, pressed: bool, value: f64) {
    let Some(b) = self.buttons.get_mut(button) else { return };
    let next = ButtonState { pressed, value: value.clamp(0.0, 1.0) };
    if *b == next {
      return;
    }
    if pressed && !b.pressed && !self.downs.contains(&(button as u32)) {
      self.downs.push(button as u32);
    }
    *b = next;
    self.dirty = true;
  }

  /// A digital press or release (gilrs's ButtonPressed / ButtonReleased). The triggers ignore it: their analog value
  /// decides, against our threshold rather than gilrs's own.
  pub fn press(&mut self, button: usize, pressed: bool) {
    if button == LEFT_TRIGGER || button == RIGHT_TRIGGER {
      return;
    }
    self.set(button, pressed, if pressed { 1.0 } else { 0.0 });
  }

  /// A button's analog value, 0..1 (gilrs's ButtonChanged). Only the triggers take it; for every other button the
  /// press and release say the same thing.
  pub fn button_value(&mut self, button: usize, value: f64) {
    if button == LEFT_TRIGGER || button == RIGHT_TRIGGER {
      self.set(button, value > PRESS_THRESHOLD, value);
    }
  }

  /// A stick axis in standard order, already with Y positive = down.
  pub fn axis(&mut self, axis: usize, value: f64) {
    let Some(a) = self.axes.get_mut(axis) else { return };
    let value = value.clamp(-1.0, 1.0);
    if *a != value {
      *a = value;
      self.dirty = true;
    }
  }

  /// A D-pad reported as a hat axis: x positive = right, y positive = up (gilrs's sign).
  pub fn dpad_axis(&mut self, horizontal: bool, value: f64) {
    let (neg, pos) = if horizontal { (DPAD_LEFT, DPAD_RIGHT) } else { (DPAD_DOWN, DPAD_UP) };
    self.press(neg, value < -PRESS_THRESHOLD);
    self.press(pos, value > PRESS_THRESHOLD);
  }

  /// Whether a `state` emit is due at `now_ms`: something changed and the interval since the last emit has passed.
  pub fn due(&self, now_ms: f64) -> bool {
    self.dirty && now_ms - self.last_emit_ms >= MIN_EMIT_INTERVAL_MS
  }

  /// The payload to emit now; this counts as an emit (clears `downs` and the change flag).
  pub fn take_payload(&mut self, now_ms: f64, connected: bool) -> PadPayload {
    self.dirty = false;
    self.last_emit_ms = now_ms;
    PadPayload {
      index: self.index,
      id: self.id.clone(),
      connected,
      buttons: if connected { self.buttons } else { [ButtonState::default(); BUTTONS] },
      axes: if connected { self.axes } else { [0.0; AXES] },
      timestamp: now_ms,
      downs: std::mem::take(&mut self.downs),
    }
  }
}

/// The lowest slot no connected pad holds, so a reconnected pad takes back the slot it freed (0..3 with up to four
/// pads; a fifth gets 4).
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
pub fn free_slot(taken: impl Iterator<Item = u32>) -> u32 {
  let taken: Vec<u32> = taken.collect();
  (0..).find(|i| !taken.contains(i)).unwrap_or(0)
}

// ---------------------------------------------------------------------------------------------------------------
// The bridge thread (Linux only)

#[cfg(target_os = "linux")]
mod linux {
  use std::collections::HashMap;
  use std::sync::atomic::AtomicBool;
  use std::sync::atomic::Ordering::Release;
  use std::sync::mpsc;
  use std::sync::OnceLock;
  use std::time::{Duration, Instant};

  use gilrs::{Axis, Button, EventType, GamepadId, Gilrs, GilrsBuilder};
  use tauri::{AppHandle, Emitter};

  use super::*;

  /// Whether the first call got the bridge started; set once.
  static ENABLED: OnceLock<bool> = OnceLock::new();
  /// Whether the thread is polling now; cleared on any exit, so a later call answers false.
  static RUNNING: AtomicBool = AtomicBool::new(false);
  static HANDSHAKE: Handshake = Handshake::new();

  /// A failure worth seeing in a release build, where `log` goes nowhere.
  fn fail(msg: &str) {
    log::warn!("Gamepad bridge: {msg}");
    eprintln!("[gamepad-bridge] {msg}");
  }

  /// Standard-mapping index of a gilrs button, `None` for the ones the standard layout has no place for.
  fn button_index(b: Button) -> Option<usize> {
    Some(match b {
      Button::South => 0,
      Button::East => 1,
      Button::West => 2,
      Button::North => 3,
      Button::LeftTrigger => 4,
      Button::RightTrigger => 5,
      Button::LeftTrigger2 => LEFT_TRIGGER,
      Button::RightTrigger2 => RIGHT_TRIGGER,
      Button::Select => 8,
      Button::Start => 9,
      Button::LeftThumb => 10,
      Button::RightThumb => 11,
      Button::DPadUp => DPAD_UP,
      Button::DPadDown => DPAD_DOWN,
      Button::DPadLeft => DPAD_LEFT,
      Button::DPadRight => DPAD_RIGHT,
      Button::Mode => 16,
      _ => return None,
    })
  }

  /// Starts the thread on the first call and waits (blocking) for gilrs to initialise. Every call answers whether the
  /// thread is running now.
  pub fn start(app: AppHandle) -> bool {
    let enabled = *ENABLED.get_or_init(|| {
      let (tx, rx) = mpsc::channel::<bool>();
      let spawned = std::thread::Builder::new().name("gamepad-bridge".into()).spawn(move || {
        let mut started = false;
        // gilrs has `unimplemented!()` paths; a panic there must end this thread only, with a log line.
        let run = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
          // No force feedback: the game doesn't rumble, and it would start gilrs's own FF thread.
          match GilrsBuilder::new().with_force_feedback(false).build() {
            Ok(gilrs) => {
              if !HANDSHAKE.begin() {
                fail("gilrs started after the page stopped waiting; not polling");
                return;
              }
              started = true;
              RUNNING.store(true, Release);
              let _ = tx.send(true);
              worker(&app, gilrs);
            }
            Err(e) => {
              fail(&format!("gilrs failed to start: {e}"));
              let _ = tx.send(false);
            }
          }
        }));
        if run.is_err() {
          fail("the thread panicked");
        }
        RUNNING.store(false, Release);
        if started {
          fail("stopped; the page falls back to the webview's gamepads");
          let _ = app.emit(EVENT, BridgeEvent { kind: "stopped", pad: None });
        }
      });
      if let Err(e) = spawned {
        fail(&format!("could not spawn the thread: {e}"));
        return false;
      }
      // udev enumeration is quick; a hang (or a panic before the send) reads as disabled, unless the thread started
      // in the same instant.
      rx.recv_timeout(Duration::from_secs(3)).unwrap_or(false) || HANDSHAKE.give_up()
    });
    enabled && RUNNING.load(Acquire)
  }

  fn emit(app: &AppHandle, kind: &'static str, pad: PadPayload) -> bool {
    match app.emit(EVENT, BridgeEvent { kind, pad: Some(pad) }) {
      Ok(()) => true,
      Err(e) => {
        fail(&format!("emit failed, stopping: {e}"));
        false
      }
    }
  }

  fn connect(gilrs: &Gilrs, pads: &mut HashMap<GamepadId, PadState>, id: GamepadId) -> PadState {
    let gp = gilrs.gamepad(id);
    let slot = free_slot(pads.values().map(|p| p.index));
    PadState::new(slot, pad_id(gp.name(), gp.vendor_id(), gp.product_id()))
  }

  /// Polls until an emit fails; the caller clears `RUNNING` and sends `stopped`.
  fn worker(app: &AppHandle, mut gilrs: Gilrs) {
    let start = Instant::now();
    let now_ms = || start.elapsed().as_secs_f64() * 1000.0;
    let mut pads: HashMap<GamepadId, PadState> = HashMap::new();

    // gilrs sends no Connected event for pads plugged in before it started.
    let initial: Vec<GamepadId> = gilrs.gamepads().map(|(id, _)| id).collect();
    for id in initial {
      let mut pad = connect(&gilrs, &mut pads, id);
      log::info!("Gamepad bridge: {} in slot {}", pad.id, pad.index);
      if !emit(app, "connected", pad.take_payload(now_ms(), true)) {
        return;
      }
      pads.insert(id, pad);
    }

    loop {
      while let Some(ev) = gilrs.next_event() {
        match ev.event {
          EventType::Connected => {
            // A Connected for a pad we still hold (no Disconnected in between) replaces it in its own slot.
            pads.remove(&ev.id);
            let mut pad = connect(&gilrs, &mut pads, ev.id);
            log::info!("Gamepad bridge: {} connected in slot {}", pad.id, pad.index);
            if !emit(app, "connected", pad.take_payload(now_ms(), true)) {
              return;
            }
            pads.insert(ev.id, pad);
          }
          EventType::Disconnected => {
            if let Some(mut pad) = pads.remove(&ev.id) {
              log::info!("Gamepad bridge: {} disconnected from slot {}", pad.id, pad.index);
              if !emit(app, "disconnected", pad.take_payload(now_ms(), false)) {
                return;
              }
            }
          }
          _ => {
            let Some(pad) = pads.get_mut(&ev.id) else { continue };
            match ev.event {
              EventType::ButtonPressed(b, _) => button_index(b).into_iter().for_each(|i| pad.press(i, true)),
              EventType::ButtonReleased(b, _) => button_index(b).into_iter().for_each(|i| pad.press(i, false)),
              EventType::ButtonChanged(b, v, _) => {
                button_index(b).into_iter().for_each(|i| pad.button_value(i, v as f64))
              }
              // gilrs has Y positive = up; the standard layout has it down.
              EventType::AxisChanged(Axis::LeftStickX, v, _) => pad.axis(0, v as f64),
              EventType::AxisChanged(Axis::LeftStickY, v, _) => pad.axis(1, -(v as f64)),
              EventType::AxisChanged(Axis::RightStickX, v, _) => pad.axis(2, v as f64),
              EventType::AxisChanged(Axis::RightStickY, v, _) => pad.axis(3, -(v as f64)),
              // gilrs's default filters already turn a hat into D-pad buttons when it can; this covers the rest.
              EventType::AxisChanged(Axis::DPadX, v, _) => pad.dpad_axis(true, v as f64),
              EventType::AxisChanged(Axis::DPadY, v, _) => pad.dpad_axis(false, v as f64),
              // LeftZ / RightZ only appear on pads with no SDL mapping, where nothing says what they are.
              _ => {}
            }
          }
        }
      }

      let now = now_ms();
      for pad in pads.values_mut() {
        if pad.due(now) && !emit(app, "state", pad.take_payload(now, true)) {
          return;
        }
      }
      std::thread::sleep(Duration::from_millis(POLL_SLEEP_MS));
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Commands

/// `enabled` is true on Linux once gilrs has initialised; the first call starts the bridge thread. Always false on
/// Windows and macOS, where the webview's own Gamepad API is used, and false again once the thread has stopped. The
/// wait for gilrs runs on a blocking thread, off both the main thread and the async runtime's workers.
#[tauri::command]
pub async fn gamepad_bridge_status(app: tauri::AppHandle) -> GamepadBridgeStatus {
  #[cfg(target_os = "linux")]
  let enabled = tauri::async_runtime::spawn_blocking(move || linux::start(app)).await.unwrap_or(false);
  #[cfg(not(target_os = "linux"))]
  let enabled = {
    let _ = app;
    false
  };
  GamepadBridgeStatus { enabled }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn pad() -> PadState {
    PadState::new(0, "Pad".into())
  }

  #[test]
  fn id_has_the_standard_gamepad_shape() {
    assert_eq!(
      pad_id("8BitDo Ultimate 2", Some(0x2dc8), Some(0x310b)),
      "8BitDo Ultimate 2 (STANDARD GAMEPAD Vendor: 2dc8 Product: 310b)"
    );
    assert_eq!(pad_id("X", None, None), "X (STANDARD GAMEPAD Vendor: 0000 Product: 0000)");
  }

  #[test]
  fn a_tap_between_emits_survives_in_downs() {
    let mut p = pad();
    p.press(0, true);
    p.press(0, false);
    assert!(p.due(0.0));
    let out = p.take_payload(0.0, true);
    assert_eq!(out.downs, [0]);
    assert!(!out.buttons[0].pressed);
    // The next emit starts with no downs.
    p.press(1, true);
    assert_eq!(p.take_payload(10.0, true).downs, [1]);
  }

  #[test]
  fn emits_are_coalesced_to_the_interval() {
    let mut p = pad();
    p.axis(0, 0.3);
    p.take_payload(100.0, true);
    p.axis(0, 0.4);
    assert!(!p.due(104.0));
    assert!(p.due(108.0));
    p.take_payload(108.0, true);
    assert!(!p.due(200.0), "nothing changed");
    p.axis(0, 0.4);
    assert!(!p.due(200.0), "the same value is no change");
  }

  #[test]
  fn triggers_press_past_half_and_ignore_digital_events() {
    let mut p = pad();
    p.press(LEFT_TRIGGER, true);
    assert!(!p.take_payload(0.0, true).buttons[LEFT_TRIGGER].pressed);
    p.button_value(LEFT_TRIGGER, 0.4);
    let out = p.take_payload(10.0, true);
    assert_eq!(out.buttons[LEFT_TRIGGER], ButtonState { pressed: false, value: 0.4 });
    assert!(out.downs.is_empty());
    p.button_value(LEFT_TRIGGER, 0.9);
    let out = p.take_payload(20.0, true);
    assert!(out.buttons[LEFT_TRIGGER].pressed);
    assert_eq!(out.downs, [LEFT_TRIGGER as u32]);
  }

  #[test]
  fn hat_axes_become_dpad_buttons() {
    let mut p = pad();
    p.dpad_axis(false, 1.0);
    p.dpad_axis(true, -1.0);
    let out = p.take_payload(0.0, true);
    assert!(out.buttons[DPAD_UP].pressed && out.buttons[DPAD_LEFT].pressed);
    assert_eq!(out.downs, [DPAD_UP as u32, DPAD_LEFT as u32]);
    p.dpad_axis(false, -1.0);
    p.dpad_axis(true, 0.0);
    let out = p.take_payload(10.0, true);
    assert!(!out.buttons[DPAD_UP].pressed && out.buttons[DPAD_DOWN].pressed && !out.buttons[DPAD_LEFT].pressed);
  }

  #[test]
  fn disconnected_payload_reads_released() {
    let mut p = pad();
    p.press(3, true);
    p.axis(1, 1.0);
    let out = p.take_payload(0.0, false);
    assert!(!out.connected && !out.buttons[3].pressed && out.axes[1] == 0.0);
  }

  #[test]
  fn slots_reuse_the_lowest_free() {
    assert_eq!(free_slot([].into_iter()), 0);
    assert_eq!(free_slot([0, 1, 3].into_iter()), 2);
    assert_eq!(free_slot([1, 2].into_iter()), 0);
  }

  #[test]
  fn payload_serializes_in_the_contract_shape() {
    let mut p = PadState::new(1, pad_id("Pad", Some(1), Some(2)));
    p.press(0, true);
    let json = serde_json::to_value(BridgeEvent { kind: "state", pad: Some(p.take_payload(12.5, true)) }).unwrap();
    assert_eq!(json["kind"], "state");
    assert_eq!(json["pad"]["index"], 1);
    assert_eq!(json["pad"]["buttons"].as_array().unwrap().len(), 17);
    assert_eq!(json["pad"]["buttons"][0], serde_json::json!({ "pressed": true, "value": 1.0 }));
    assert_eq!(json["pad"]["axes"].as_array().unwrap().len(), 4);
    assert_eq!(json["pad"]["timestamp"], 12.5);
    assert_eq!(json["pad"]["downs"], serde_json::json!([0]));
  }

  #[test]
  fn stopped_has_no_pad() {
    let json = serde_json::to_value(BridgeEvent { kind: "stopped", pad: None }).unwrap();
    assert_eq!(json, serde_json::json!({ "kind": "stopped" }));
  }

  #[test]
  fn handshake_lets_exactly_one_side_win() {
    // The thread starts in time: it runs, and a give-up racing it still reads as started.
    let h = Handshake::new();
    assert!(h.begin());
    assert!(h.give_up());
    // The command gave up first: the thread must not run.
    let h = Handshake::new();
    assert!(!h.give_up());
    assert!(!h.begin());
  }
}
