//! Recovers the Linux app's page when WebKitGTK's web process hangs for good.
//!
//! On Bazzite (KDE, an RX 9070 XT, the AppImage) the page sometimes froze after the display slept or the TV went off
//! and on again: nothing redrew and no input landed, while the window, the native audio and the window manager kept
//! working, and Alt+F4 logged "WebProcess didn't exit as expected" (the owner, 2026-10-25). The web process was stuck,
//! under Wayland and X11 and with compositing off. Nothing in the page can fix that, so the shell watches for it.
//!
//! The page sends `hang_watchdog_beat` about once a second from a main-thread timer (`src/platform/hang-watchdog.ts`),
//! saying whether it is hidden. A background thread here checks once a second. It calls the page hung only when that
//! is clear and the window is in use: no beat for `STALL_VISIBLE` (or the longer `STALL_HIDDEN` when the page's last
//! beat said it was hidden, since WebKit may slow a hidden page's timers), the window focused, focus held for at least
//! `FOCUS_GRACE` (a healthy page catches up within moments of focus coming back), and the window visible and not
//! minimized. It never acts before the page's first beat, so a slow first load is never mistaken for a hang. Then it
//! kills the web process and loads the page again, at most once per `MIN_RECOVERY_GAP`, and waits for the new page's
//! first beat before judging again, so it cannot loop. Every move in the game is already in IndexedDB
//! (`engine/game-storage.ts`), so the reloaded page opens on Title with the game under "Continue".
//!
//! Linux only: elsewhere the command answers false and the page stops beating. `MC_DISABLE_HANG_WATCHDOG=1` turns it
//! off on Linux too (the command then answers false as well).
// The decision logic is compiled (and tested) everywhere but only driven on Linux.
#![cfg_attr(not(target_os = "linux"), allow(dead_code))]

use std::sync::Mutex;
use std::time::{Duration, Instant};

/// No beat for this long from a page that last said it was visible.
pub const STALL_VISIBLE: Duration = Duration::from_secs(10);
/// No beat for this long from a page that last said it was hidden.
pub const STALL_HIDDEN: Duration = Duration::from_secs(30);
/// How long the window must have held focus (or the watchdog been running) before a stall counts.
pub const FOCUS_GRACE: Duration = Duration::from_secs(10);
/// The shortest time between two recoveries.
pub const MIN_RECOVERY_GAP: Duration = Duration::from_secs(30);
/// How often the background thread looks.
const CHECK_EVERY: Duration = Duration::from_secs(1);
/// The environment variable that turns the watchdog off.
const DISABLE_ENV: &str = "MC_DISABLE_HANG_WATCHDOG";

// ---------------------------------------------------------------------------------------------------------------
// Pure parts (compiled everywhere so they are tested on every platform)

/// What the watchdog knows, fed by beats, focus changes and recoveries; `now` is always passed in.
#[derive(Clone, Debug)]
pub struct Watch {
  /// The last beat and whether the page said it was hidden; None until the (re)loaded page's first beat.
  last_beat: Option<(Instant, bool)>,
  /// The window's focus from its last focus event; None before the first one.
  focused: Option<bool>,
  /// When focus last changed, or when watching started.
  focus_since: Instant,
  last_recovery: Option<Instant>,
}

impl Watch {
  pub fn new(now: Instant) -> Self {
    Watch { last_beat: None, focused: None, focus_since: now, last_recovery: None }
  }

  pub fn beat(&mut self, now: Instant, hidden: bool) {
    self.last_beat = Some((now, hidden));
  }

  pub fn focus(&mut self, now: Instant, focused: bool) {
    if self.focused != Some(focused) {
      self.focused = Some(focused);
      self.focus_since = now;
    }
  }

  /// The window's focus as far as events tell, or None when no event has come yet (ask the window).
  pub fn known_focus(&self) -> Option<bool> {
    self.focused
  }

  /// A recovery started: forget the old page's beats and wait for the new page's first one.
  pub fn recovered(&mut self, now: Instant) {
    self.last_recovery = Some(now);
    self.last_beat = None;
  }

  /// A page load started (the page's own reload, a save import's, or a recovery's): the old page's beats no longer
  /// say anything, and a slow cold load must not be taken for a hang, so wait for the new page's first beat.
  pub fn page_load_started(&mut self) {
    self.last_beat = None;
  }

  /// `stalled`, and when it is, the recovery recorded in the same step, so a beat that lands in between can't be
  /// overruled by a stale verdict.
  pub fn begin_recovery(&mut self, now: Instant) -> Option<Duration> {
    let stall = self.stalled(now)?;
    self.recovered(now);
    Some(stall)
  }

  /// How long the page has gone without a beat, when that is long enough to call it hung and nothing that this state
  /// knows of rules it out. The caller still checks the window is focused (when no focus event has come), visible
  /// and not minimized before acting.
  pub fn stalled(&self, now: Instant) -> Option<Duration> {
    let (at, hidden) = self.last_beat?;
    if self.focused == Some(false) || now.saturating_duration_since(self.focus_since) < FOCUS_GRACE {
      return None;
    }
    if self.last_recovery.is_some_and(|r| now.saturating_duration_since(r) < MIN_RECOVERY_GAP) {
      return None;
    }
    let stall = now.saturating_duration_since(at);
    let limit = if hidden { STALL_HIDDEN } else { STALL_VISIBLE };
    (stall >= limit).then_some(stall)
  }
}

/// True unless the variable is set to something other than "" or "0".
fn enabled_by_env(value: Option<&std::ffi::OsStr>) -> bool {
  match value {
    None => true,
    Some(v) => v.is_empty() || v == "0",
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The live watchdog

/// None when the watchdog is off (not Linux, turned off, or not started yet).
static WATCH: Mutex<Option<Watch>> = Mutex::new(None);

fn with_watch<R>(f: impl FnOnce(&mut Watch) -> R) -> Option<R> {
  let mut guard = WATCH.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
  guard.as_mut().map(f)
}

/// The page's heartbeat. Answers whether the watchdog is on, so the page stops beating when it is not.
#[tauri::command]
pub fn hang_watchdog_beat(hidden: bool) -> bool {
  with_watch(|watch| watch.beat(Instant::now(), hidden)).is_some()
}

/// The main window's focus changed (`lib.rs`'s window events).
pub fn on_focus(focused: bool) {
  with_watch(|watch| watch.focus(Instant::now(), focused));
}

/// A page load started in a webview (`lib.rs`'s `on_page_load`).
pub fn on_page_load_started() {
  with_watch(Watch::page_load_started);
}

/// Starts the watchdog on Linux unless `MC_DISABLE_HANG_WATCHDOG` is set; does nothing elsewhere, nor in a debug build
/// (`tauri dev`, where a devtools breakpoint stops the page's timers on purpose).
#[allow(unused_variables)]
pub fn start(app: &tauri::AppHandle) {
  #[cfg(target_os = "linux")]
  linux::start(app);
}

#[cfg(target_os = "linux")]
mod linux {
  use super::*;
  use tauri::Manager;
  use webkit2gtk::WebViewExt;

  pub fn start(app: &tauri::AppHandle) {
    if cfg!(debug_assertions) {
      eprintln!("hang watchdog: off (debug build)");
      return;
    }
    if !enabled_by_env(std::env::var_os(DISABLE_ENV).as_deref()) {
      eprintln!("hang watchdog: off ({DISABLE_ENV} is set)");
      return;
    }
    *WATCH.lock().unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(Watch::new(Instant::now()));
    let app = app.clone();
    let spawned = std::thread::Builder::new().name("hang-watchdog".into()).spawn(move || loop {
      std::thread::sleep(CHECK_EVERY);
      let Some((Some(_), known_focus)) = with_watch(|watch| (watch.stalled(Instant::now()), watch.known_focus()))
      else {
        continue;
      };
      // Only now ask the window anything: each question is a round trip to the main thread.
      let Some(window) = app.get_webview_window("main").or_else(|| app.webview_windows().into_values().next())
      else {
        continue;
      };
      let focused = known_focus.unwrap_or_else(|| window.is_focused().unwrap_or(false));
      let shown = window.is_visible().unwrap_or(false) && !window.is_minimized().unwrap_or(true);
      if !focused || !shown {
        continue;
      }
      // Those questions block on the GTK main thread, which is also where beats arrive: after a long main-thread stall
      // (the compositor around display sleep) a fresh beat may have landed meanwhile, so decide again.
      let Some(Some(stall)) = with_watch(|watch| watch.begin_recovery(Instant::now())) else {
        continue;
      };
      eprintln!("hang watchdog: no heartbeat from the page for {}s; restarting the web process", stall.as_secs());
      let result = window.with_webview(|webview| {
        let view = webview.inner();
        let uri = view.uri().filter(|uri| !uri.is_empty());
        view.terminate_web_process();
        // A new load starts a new web process; the old one is gone (web-process-terminated, "by API").
        match uri {
          Some(uri) => view.load_uri(&uri),
          None => view.reload(),
        }
      });
      if let Err(error) = result {
        eprintln!("hang watchdog: could not reach the webview: {error}");
      }
    });
    if let Err(error) = spawned {
      eprintln!("hang watchdog: could not start: {error}");
      *WATCH.lock().unwrap_or_else(|poisoned| poisoned.into_inner()) = None;
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn secs(n: u64) -> Duration {
    Duration::from_secs(n)
  }

  /// A watch started at `t0`, focused at `t0`, beating (visible) at `t0 + 1s`.
  fn steady(t0: Instant) -> Watch {
    let mut watch = Watch::new(t0);
    watch.focus(t0, true);
    watch.beat(t0 + secs(1), false);
    watch
  }

  #[test]
  fn a_page_that_keeps_beating_is_not_hung() {
    let t0 = Instant::now();
    let mut watch = steady(t0);
    for n in 2..120 {
      watch.beat(t0 + secs(n), false);
      assert_eq!(watch.stalled(t0 + secs(n) + Duration::from_millis(900)), None);
    }
  }

  #[test]
  fn a_visible_page_silent_past_the_limit_is_hung() {
    let t0 = Instant::now();
    let watch = steady(t0);
    assert_eq!(watch.stalled(t0 + secs(1) + STALL_VISIBLE - Duration::from_millis(1)), None);
    assert_eq!(watch.stalled(t0 + secs(1) + STALL_VISIBLE), Some(STALL_VISIBLE));
  }

  #[test]
  fn a_hidden_page_gets_the_longer_limit() {
    let t0 = Instant::now();
    let mut watch = steady(t0);
    watch.beat(t0 + secs(20), true);
    assert_eq!(watch.stalled(t0 + secs(20) + STALL_VISIBLE), None);
    assert_eq!(watch.stalled(t0 + secs(20) + STALL_HIDDEN), Some(STALL_HIDDEN));
  }

  #[test]
  fn nothing_counts_before_the_first_beat() {
    let t0 = Instant::now();
    let mut watch = Watch::new(t0);
    watch.focus(t0, true);
    assert_eq!(watch.stalled(t0 + secs(600)), None);
  }

  #[test]
  fn an_unfocused_window_is_never_hung() {
    let t0 = Instant::now();
    let mut watch = steady(t0);
    watch.focus(t0 + secs(2), false);
    assert_eq!(watch.stalled(t0 + secs(600)), None);
  }

  #[test]
  fn focus_coming_back_gives_the_page_a_grace_period() {
    let t0 = Instant::now();
    let mut watch = steady(t0);
    watch.focus(t0 + secs(2), false);
    // Away for ten minutes, the page's timers slowed or paused.
    let back = t0 + secs(600);
    watch.focus(back, true);
    assert_eq!(watch.stalled(back + FOCUS_GRACE - Duration::from_millis(1)), None);
    // A healthy page beats as soon as it is back...
    let mut healthy = watch.clone();
    healthy.beat(back + secs(1), false);
    assert_eq!(healthy.stalled(back + FOCUS_GRACE), None);
    // ...a hung one does not.
    assert!(watch.stalled(back + FOCUS_GRACE).is_some());
  }

  #[test]
  fn a_repeated_focus_event_does_not_restart_the_grace() {
    let t0 = Instant::now();
    let mut watch = steady(t0);
    watch.focus(t0 + secs(5), true);
    assert!(watch.stalled(t0 + secs(1) + STALL_VISIBLE).is_some());
  }

  #[test]
  fn the_grace_also_covers_the_start_when_no_focus_event_came() {
    let t0 = Instant::now();
    let mut watch = Watch::new(t0);
    watch.beat(t0, false);
    // Focus unknown: the state allows it once the start grace is over, and the caller asks the window.
    assert_eq!(watch.stalled(t0 + FOCUS_GRACE - Duration::from_millis(1)), None);
    assert!(watch.stalled(t0 + FOCUS_GRACE).is_some());
    assert_eq!(watch.known_focus(), None);
  }

  #[test]
  fn after_a_recovery_it_waits_for_the_new_page_and_the_gap() {
    let t0 = Instant::now();
    let mut watch = steady(t0);
    let recovered_at = t0 + secs(12);
    assert!(watch.stalled(recovered_at).is_some());
    watch.recovered(recovered_at);
    // No beat from the new page yet: never again, however long.
    assert_eq!(watch.stalled(recovered_at + secs(300)), None);
    // The new page beats once and hangs straight away: still not before the gap is up.
    watch.beat(recovered_at + secs(2), false);
    assert_eq!(watch.stalled(recovered_at + MIN_RECOVERY_GAP - Duration::from_millis(1)), None);
    assert!(watch.stalled(recovered_at + MIN_RECOVERY_GAP).is_some());
  }

  #[test]
  fn a_page_load_waits_for_the_new_pages_first_beat() {
    let t0 = Instant::now();
    let mut watch = steady(t0);
    // The page reloads itself (a save import, the startup watchdog's Reload) and takes a while to boot.
    watch.page_load_started();
    assert_eq!(watch.stalled(t0 + secs(300)), None);
    watch.beat(t0 + secs(40), false);
    assert_eq!(watch.stalled(t0 + secs(41)), None);
    assert!(watch.stalled(t0 + secs(40) + STALL_VISIBLE).is_some());
  }

  #[test]
  fn begin_recovery_decides_again_and_records_the_recovery() {
    let t0 = Instant::now();
    let mut watch = steady(t0);
    // A beat landed while the window was being asked: no recovery.
    watch.beat(t0 + secs(14), false);
    assert_eq!(watch.begin_recovery(t0 + secs(15)), None);
    // Still silent: recover, and only once.
    let at = t0 + secs(14) + STALL_VISIBLE;
    assert_eq!(watch.begin_recovery(at), Some(STALL_VISIBLE));
    assert_eq!(watch.begin_recovery(at + secs(1)), None);
  }

  #[test]
  fn the_env_var_turns_it_off() {
    use std::ffi::OsStr;
    assert!(enabled_by_env(None));
    assert!(enabled_by_env(Some(OsStr::new(""))));
    assert!(enabled_by_env(Some(OsStr::new("0"))));
    assert!(!enabled_by_env(Some(OsStr::new("1"))));
    assert!(!enabled_by_env(Some(OsStr::new("yes"))));
  }
}
