//! Discord Rich Presence: what the player is doing, shown on their Discord profile.
//!
//! A background thread owns the IPC client (a named pipe on Windows, a unix socket on macOS and Linux). The page
//! describes its activity through `discord_set_activity`; the thread connects lazily, retries every
//! `RECONNECT_MS` while Discord isn't running (or after it restarts, resending the latest activity), and sends at most
//! one update per `MIN_SEND_INTERVAL_MS` (Discord allows 5 per 20 s), keeping only the newest while it waits.
//!
//! The application id is the game's built-in one (`DEFAULT_APP_ID`, public); `MC_DISCORD_APP_ID` set at build time
//! (a CI variable) replaces it, and set at run time replaces both, for local testing. A blank value is ignored. Nothing here can block the
//! app or panic it: every Discord error just drops the connection and schedules a retry.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use discord_rich_presence::activity::{Activity, Assets, Button, Timestamps};
use discord_rich_presence::{DiscordIpc, DiscordIpcClient};
use serde::{Deserialize, Serialize};

/// Discord allows 5 updates per 20 s; one per 4 s stays inside that with no burst.
const MIN_SEND_INTERVAL_MS: u64 = 4_000;
/// How often to look for Discord again while it isn't reachable.
const RECONNECT_MS: u64 = 15_000;
/// Discord's limit for details, state and image text.
const MAX_TEXT: usize = 128;
/// Discord's limit for a button label.
const MAX_BUTTON_LABEL: usize = 32;
/// Discord's limit for a button URL (and, generously, an image key or URL).
const MAX_URL: usize = 512;
const MAX_BUTTONS: usize = 2;

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct DiscordButton {
  pub label: String,
  pub url: String,
}

/// The page's description of the activity. Images are asset keys uploaded to the Discord application, or https URLs.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordActivity {
  pub details: Option<String>,
  pub state: Option<String>,
  /// Unix seconds; Discord shows "elapsed" from it.
  pub start_timestamp: Option<i64>,
  pub large_image: Option<String>,
  pub large_text: Option<String>,
  pub small_image: Option<String>,
  pub small_text: Option<String>,
  pub buttons: Option<Vec<DiscordButton>>,
}

#[derive(Clone, Copy, Debug, Serialize)]
pub struct DiscordStatus {
  pub enabled: bool,
  pub connected: bool,
}

// ---------------------------------------------------------------------------------------------------------------
// Pure parts

/// Cuts `text` to `max` characters (not bytes, so a multi-byte character is never split).
pub fn truncate(text: &str, max: usize) -> String {
  text.chars().take(max).collect()
}

/// A text field as Discord accepts it: trimmed, cut to `max`, and `None` when shorter than `min` characters
/// (Discord rejects details and state under 2, so such a field is dropped rather than padded).
fn clean(text: &Option<String>, max: usize, min: usize) -> Option<String> {
  let text = truncate(text.as_deref()?.trim(), max);
  (text.chars().count() >= min.max(1)).then_some(text)
}

impl DiscordActivity {
  /// The activity with every limit applied. Blank strings become `None`; buttons need a label and an http(s) URL,
  /// and at most two are kept.
  pub fn sanitized(&self) -> DiscordActivity {
    let buttons: Vec<DiscordButton> = self
      .buttons
      .iter()
      .flatten()
      .filter_map(|b| {
        let label = truncate(b.label.trim(), MAX_BUTTON_LABEL);
        let url = b.url.trim();
        let ok = (url.starts_with("https://") || url.starts_with("http://")) && url.chars().count() <= MAX_URL;
        (!label.is_empty() && ok).then(|| DiscordButton { label, url: url.to_string() })
      })
      .take(MAX_BUTTONS)
      .collect();
    DiscordActivity {
      details: clean(&self.details, MAX_TEXT, 2),
      state: clean(&self.state, MAX_TEXT, 2),
      start_timestamp: self.start_timestamp,
      large_image: clean(&self.large_image, MAX_URL, 1),
      large_text: clean(&self.large_text, MAX_TEXT, 2),
      small_image: clean(&self.small_image, MAX_URL, 1),
      small_text: clean(&self.small_text, MAX_TEXT, 2),
      buttons: if buttons.is_empty() { None } else { Some(buttons) },
    }
  }
}

/// Rate limiting and coalescing, with the clock passed in (milliseconds from any fixed start) so it is testable.
/// `Some(activity)` sets, `None` clears.
#[derive(Debug)]
pub struct Scheduler<A: Clone> {
  interval_ms: u64,
  last_sent_ms: Option<u64>,
  /// The newest thing not yet sent; a newer submit replaces it.
  pending: Option<Option<A>>,
  /// The last thing submitted, so a reconnect can resend it.
  latest: Option<Option<A>>,
}

impl<A: Clone> Scheduler<A> {
  pub fn new(interval_ms: u64) -> Self {
    Scheduler { interval_ms, last_sent_ms: None, pending: None, latest: None }
  }

  /// A new desired activity (or `None` to clear); replaces anything still waiting to be sent.
  pub fn submit(&mut self, activity: Option<A>) {
    self.latest = Some(activity.clone());
    self.pending = Some(activity);
  }

  /// The connection was lost or made anew: the latest submission must be sent again (unless a newer one waits).
  pub fn resend_latest(&mut self) {
    if self.pending.is_none() {
      self.pending = self.latest.clone();
    }
  }

  /// Milliseconds until something may be sent: `None` when nothing is waiting, `Some(0)` when it is due now.
  pub fn wait_ms(&self, now_ms: u64) -> Option<u64> {
    self.pending.as_ref()?;
    Some(match self.last_sent_ms {
      Some(last) => (last + self.interval_ms).saturating_sub(now_ms),
      None => 0,
    })
  }

  /// Takes what to send now, if something is waiting and the interval since the last send has passed; this counts as
  /// a send. Call `resend_latest` if the send fails.
  pub fn take_due(&mut self, now_ms: u64) -> Option<Option<A>> {
    if self.wait_ms(now_ms)? > 0 {
      return None;
    }
    self.last_sent_ms = Some(now_ms);
    self.pending.take()
  }
}

/// The game's own Discord application (a public id, not a secret), used when a build sets no `MC_DISCORD_APP_ID`.
const DEFAULT_APP_ID: &str = "1563411845782437898";

/// The run-time id when set, else the compile-time one, else the built-in default; a blank value counts as unset
/// (an empty CI variable must not switch presence off or override the default).
fn resolve_app_id(compiled: Option<&str>, runtime: Option<String>) -> String {
  let runtime = runtime.map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
  runtime
    .or_else(|| compiled.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()))
    .unwrap_or_else(|| DEFAULT_APP_ID.to_string())
}

fn app_id() -> String {
  resolve_app_id(option_env!("MC_DISCORD_APP_ID"), std::env::var("MC_DISCORD_APP_ID").ok())
}

// ---------------------------------------------------------------------------------------------------------------
// The worker thread

enum Msg {
  Set(Option<DiscordActivity>),
  /// Clear the activity now, close the connection and end the thread; acknowledged on the channel.
  Shutdown(Sender<()>),
}

struct Handle {
  tx: Mutex<Sender<Msg>>,
  connected: AtomicBool,
}

static HANDLE: OnceLock<Option<&'static Handle>> = OnceLock::new();

/// The worker, started on first use; `None` only if the thread could not be spawned.
fn handle() -> Option<&'static Handle> {
  *HANDLE.get_or_init(|| {
    let app_id = app_id();
    let (tx, rx) = mpsc::channel();
    let handle: &'static Handle = Box::leak(Box::new(Handle { tx: Mutex::new(tx), connected: AtomicBool::new(false) }));
    std::thread::Builder::new()
      .name("discord-presence".into())
      .spawn(move || worker(app_id, rx, &handle.connected))
      .ok()
      .map(|_| handle)
  })
}

fn to_activity(a: &DiscordActivity) -> Activity<'_> {
  let mut out = Activity::new();
  if let Some(v) = &a.details {
    out = out.details(v);
  }
  if let Some(v) = &a.state {
    out = out.state(v);
  }
  if let Some(t) = a.start_timestamp {
    out = out.timestamps(Timestamps::new().start(t));
  }
  if a.large_image.is_some() || a.small_image.is_some() {
    let mut assets = Assets::new();
    if let Some(v) = &a.large_image {
      assets = assets.large_image(v);
    }
    if let Some(v) = &a.large_text {
      assets = assets.large_text(v);
    }
    if let Some(v) = &a.small_image {
      assets = assets.small_image(v);
    }
    if let Some(v) = &a.small_text {
      assets = assets.small_text(v);
    }
    out = out.assets(assets);
  }
  if let Some(buttons) = &a.buttons {
    out = out.buttons(buttons.iter().map(|b| Button::new(&b.label, &b.url)).collect());
  }
  out
}

fn worker(app_id: String, rx: mpsc::Receiver<Msg>, connected: &AtomicBool) {
  let start = Instant::now();
  let now_ms = || start.elapsed().as_millis() as u64;
  let mut scheduler: Scheduler<DiscordActivity> = Scheduler::new(MIN_SEND_INTERVAL_MS);
  let mut client: Option<DiscordIpcClient> = None;
  // Don't try to connect before this time.
  let mut next_connect_ms: u64 = 0;
  // Whether a real activity was ever set (a clear is only worth sending on exit if so).
  let mut has_activity = false;

  loop {
    // Sleep until a message, or until something is due to send or the next connection attempt.
    let wait = match scheduler.wait_ms(now_ms()) {
      None => Duration::from_secs(3600),
      Some(send_wait) => {
        let connect_wait = if client.is_some() { 0 } else { next_connect_ms.saturating_sub(now_ms()) };
        Duration::from_millis(send_wait.max(connect_wait).max(50))
      }
    };
    let mut first = rx.recv_timeout(wait);
    // Drain what is already queued so only the newest activity is kept.
    loop {
      match first {
        Ok(Msg::Set(activity)) => {
          has_activity |= activity.is_some();
          scheduler.submit(activity.map(|a| a.sanitized()));
        }
        Ok(Msg::Shutdown(ack)) => {
          shutdown(&mut client, connected, has_activity);
          let _ = ack.send(());
          return;
        }
        Err(RecvTimeoutError::Timeout) => break,
        Err(RecvTimeoutError::Disconnected) => return,
      }
      first = rx.try_recv().map_err(|e| match e {
        mpsc::TryRecvError::Empty => RecvTimeoutError::Timeout,
        mpsc::TryRecvError::Disconnected => RecvTimeoutError::Disconnected,
      });
    }

    if scheduler.wait_ms(now_ms()).is_none() {
      continue;
    }
    if client.is_none() && now_ms() >= next_connect_ms {
      let mut c = DiscordIpcClient::new(&app_id);
      match c.connect() {
        Ok(()) => {
          connected.store(true, Ordering::Relaxed);
          scheduler.resend_latest();
          client = Some(c);
        }
        Err(_) => next_connect_ms = now_ms() + RECONNECT_MS,
      }
    }
    let Some(c) = client.as_mut() else { continue };
    let Some(job) = scheduler.take_due(now_ms()) else { continue };
    let sent = match &job {
      Some(a) => c.set_activity(to_activity(a)),
      None => c.clear_activity(),
    };
    if sent.is_err() {
      // Discord closed or restarted: drop the client, retry after the backoff, and resend the latest activity then.
      client = None;
      connected.store(false, Ordering::Relaxed);
      next_connect_ms = now_ms() + RECONNECT_MS;
      scheduler.resend_latest();
    }
  }
}

fn shutdown(client: &mut Option<DiscordIpcClient>, connected: &AtomicBool, had_activity: bool) {
  if let Some(mut c) = client.take() {
    if had_activity {
      let _ = c.clear_activity();
    }
    let _ = c.close();
  }
  connected.store(false, Ordering::Relaxed);
}

// ---------------------------------------------------------------------------------------------------------------
// Commands

/// Sets the Discord activity, or clears it with `None`. Silent when Discord isn't running.
#[tauri::command]
pub fn discord_set_activity(activity: Option<DiscordActivity>) {
  if let Some(h) = handle() {
    if let Ok(tx) = h.tx.lock() {
      let _ = tx.send(Msg::Set(activity));
    }
  }
}

/// `enabled` is always true (an id is always known); `connected` is whether Discord is currently reachable.
#[tauri::command]
pub fn discord_status() -> DiscordStatus {
  // Don't start the worker just to answer.
  let connected = matches!(HANDLE.get(), Some(Some(h)) if h.connected.load(Ordering::Relaxed));
  DiscordStatus { enabled: true, connected }
}

/// Clears the activity and closes the connection on the way out, waiting briefly so the clear reaches Discord.
pub fn on_exit() {
  let Some(Some(h)) = HANDLE.get() else { return };
  let (ack_tx, ack_rx) = mpsc::channel();
  if let Ok(tx) = h.tx.lock() {
    if tx.send(Msg::Shutdown(ack_tx)).is_ok() {
      drop(tx);
      let _ = ack_rx.recv_timeout(Duration::from_secs(1));
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn truncates_by_characters() {
    assert_eq!(truncate("abcdef", 3), "abc");
    assert_eq!(truncate("héllo wörld", 5), "héllo");
    assert_eq!(truncate("short", 128), "short");
    assert_eq!(truncate(&"x".repeat(300), MAX_TEXT).chars().count(), 128);
  }

  #[test]
  fn sanitizes_text_and_buttons() {
    let a = DiscordActivity {
      details: Some("x".repeat(200)),
      state: Some(" a ".into()),
      large_text: Some("   ".into()),
      buttons: Some(vec![
        DiscordButton { label: "One".into(), url: "https://a.example".into() },
        DiscordButton { label: "Bad".into(), url: "javascript:alert(1)".into() },
        DiscordButton { label: "".into(), url: "https://b.example".into() },
        DiscordButton { label: "Two".into(), url: "https://c.example".into() },
        DiscordButton { label: "Three".into(), url: "https://d.example".into() },
      ]),
      ..Default::default()
    }
    .sanitized();
    assert_eq!(a.details.unwrap().chars().count(), 128);
    assert_eq!(a.state, None, "one character is below Discord's minimum");
    assert_eq!(a.large_text, None);
    let labels: Vec<_> = a.buttons.unwrap().into_iter().map(|b| b.label).collect();
    assert_eq!(labels, ["One", "Two"]);
  }

  #[test]
  fn activity_deserializes_camel_case() {
    let a: DiscordActivity =
      serde_json::from_str(r#"{"details":"Ant-Man","startTimestamp":1700000000,"largeImage":"logo"}"#).unwrap();
    assert_eq!(a.start_timestamp, Some(1_700_000_000));
    assert_eq!(a.large_image.as_deref(), Some("logo"));
    assert!(a.buttons.is_none());
  }

  #[test]
  fn first_send_is_immediate_then_rate_limited_and_coalesced() {
    let mut s: Scheduler<&str> = Scheduler::new(4_000);
    assert_eq!(s.wait_ms(0), None);
    s.submit(Some("a"));
    assert_eq!(s.take_due(1_000), Some(Some("a")));
    // Three updates while waiting: only the newest survives.
    s.submit(Some("b"));
    s.submit(Some("c"));
    s.submit(Some("d"));
    assert_eq!(s.wait_ms(2_000), Some(3_000));
    assert_eq!(s.take_due(4_999), None);
    assert_eq!(s.take_due(5_000), Some(Some("d")));
    assert_eq!(s.take_due(20_000), None);
    assert_eq!(s.wait_ms(20_000), None);
  }

  #[test]
  fn clear_is_queued_like_any_update() {
    let mut s: Scheduler<&str> = Scheduler::new(4_000);
    s.submit(Some("a"));
    s.take_due(0);
    s.submit(None);
    assert_eq!(s.take_due(100), None);
    assert_eq!(s.take_due(4_000), Some(None));
  }

  #[test]
  fn reconnect_resends_the_latest_without_overriding_a_newer_pending() {
    let mut s: Scheduler<&str> = Scheduler::new(4_000);
    s.submit(Some("a"));
    s.take_due(0);
    s.resend_latest();
    assert_eq!(s.take_due(4_000), Some(Some("a")));
    s.submit(Some("b"));
    s.resend_latest();
    assert_eq!(s.take_due(8_000), Some(Some("b")));
    assert_eq!(s.take_due(12_000), None);
  }

  #[test]
  fn app_id_runtime_overrides_compiled_and_blank_means_default() {
    assert_eq!(resolve_app_id(Some("1"), None), "1");
    assert_eq!(resolve_app_id(Some("1"), Some("2".into())), "2");
    assert_eq!(resolve_app_id(Some("1"), Some("  ".into())), "1");
    assert_eq!(resolve_app_id(Some(""), None), DEFAULT_APP_ID);
    assert_eq!(resolve_app_id(None, Some("".into())), DEFAULT_APP_ID);
  }
}
