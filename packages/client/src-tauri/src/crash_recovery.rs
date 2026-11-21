//! Brings the Windows app's page back when WebView2's page process crashes (issue #932).
//!
//! When the page's renderer process dies (STATUS_BREAKPOINT under WebView2 158, an out-of-memory kill, a driver fault),
//! WebView2 leaves its own "Can't open this page" error in the window, and a player who doesn't think to press Refresh
//! is stuck there. The shell listens for WebView2's `ProcessFailed` event instead, logs it, and:
//!
//! 1. reloads the page, the first time;
//! 2. if the page crashes again within `CRASH_AGAIN_WINDOW` of that, loads it with `?renderer=canvas`
//!    (`src/platform/renderer-options.ts`), a safe mode without WebGL in case the GPU path is what kills it;
//! 3. if the safe page crashes within the window too, leaves WebView2's error page up rather than loop.
//!
//! A page that stops answering (WebView2 raises `RENDER_PROCESS_UNRESPONSIVE` again and again while it is hung) goes
//! the same way once it has been reported twice with no sign of life between, however far apart the reports come (WebView2
//! promises no interval): after the first report the shell runs a tiny script in the page, and an answer clears the
//! report, so two separate slow moments never add up to a reload. One report alone can be a long synchronous load.
//!
//! Safe mode lasts the rest of the session (the page's own reloads keep `?renderer=canvas` on the address) and is gone
//! at the next launch. A crash after the window has passed starts again at step 1.
//!
//! Every move in the game is already in IndexedDB (`engine/game-storage.ts`), so the reloaded page opens on Title with
//! the game under "Continue". The same idea as the Linux hang watchdog (`hang_watchdog.rs`), for WebView2's page process.
//! `MC_DISABLE_CRASH_RECOVERY=1` turns it off.
// The decision logic is compiled (and tested) everywhere but only driven on Windows.
#![cfg_attr(not(windows), allow(dead_code))]

use std::time::{Duration, Instant};

/// A crash this soon after a recovery counts as the recovered page crashing again.
pub const CRASH_AGAIN_WINDOW: Duration = Duration::from_secs(60);
/// The environment variable that turns recovery off.
const DISABLE_ENV: &str = "MC_DISABLE_CRASH_RECOVERY";

/// What to do about a page crash.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Recovery {
  /// Load the page again as it was.
  Reload,
  /// Load the page with the Canvas renderer.
  SafeMode,
  /// Leave WebView2's error page up: the safe page crashed too.
  GiveUp,
}

/// The recoveries so far; `now` is always passed in.
#[derive(Clone, Debug, Default)]
pub struct Recoveries {
  /// The last recovery and which it was.
  last: Option<(Instant, Recovery)>,
}

impl Recoveries {
  /// Decides what to do about a crash at `now`, and remembers it.
  pub fn on_crash(&mut self, now: Instant) -> Recovery {
    let next = match self.last {
      Some((at, previous)) if now.saturating_duration_since(at) < CRASH_AGAIN_WINDOW => match previous {
        Recovery::Reload => Recovery::SafeMode,
        Recovery::SafeMode | Recovery::GiveUp => Recovery::GiveUp,
      },
      _ => Recovery::Reload,
    };
    self.last = Some((now, next));
    next
  }

  /// The reload WebView2 was asked for was refused, so safe mode was tried at `now` instead: a crash after that is a
  /// safe page crashing.
  pub fn escalated(&mut self, now: Instant) {
    self.last = Some((now, Recovery::SafeMode));
  }
}

/// Unresponsive reports, and whether the page has answered since the last one.
#[derive(Clone, Debug, Default)]
pub struct HangWatch {
  /// The last report the page hasn't answered since.
  open: Option<Instant>,
}

impl HangWatch {
  /// A report at `now`: true when an earlier report is still unanswered, however long ago it came (a hang). Otherwise
  /// this report is the one the page has to answer.
  pub fn report(&mut self, now: Instant) -> bool {
    if self.open.is_some() {
      return true;
    }
    self.open = Some(now);
    false
  }

  /// The page answered the probe sent for the report at `at`; true if that report was still open.
  pub fn answered(&mut self, at: Instant) -> bool {
    if self.open == Some(at) {
      self.open = None;
      return true;
    }
    false
  }

  /// The page was recovered: forget the reports.
  pub fn clear(&mut self) {
    self.open = None;
  }
}

/// `url` with `renderer=canvas` in its query (replacing any `renderer=` already there), its fragment kept.
pub fn safe_mode_url(url: &str) -> String {
  let (before_hash, hash) = match url.find('#') {
    Some(i) => (&url[..i], &url[i..]),
    None => (url, ""),
  };
  let (path, query) = match before_hash.find('?') {
    Some(i) => (&before_hash[..i], &before_hash[i + 1..]),
    None => (before_hash, ""),
  };
  let mut params: Vec<&str> = query.split('&').filter(|p| !p.is_empty() && !p.starts_with("renderer=")).collect();
  params.push("renderer=canvas");
  format!("{path}?{}{hash}", params.join("&"))
}

fn disabled() -> bool {
  std::env::var(DISABLE_ENV).map(|value| value == "1").unwrap_or(false)
}

#[cfg(windows)]
pub use windows_impl::start;

/// Elsewhere there is nothing to watch (Linux has `hang_watchdog.rs`).
#[cfg(not(windows))]
pub fn start(_app: &tauri::AppHandle) {}

#[cfg(windows)]
mod windows_impl {
  use super::{disabled, safe_mode_url, HangWatch, Recoveries, Recovery};
  use std::sync::Mutex;
  use std::time::Instant;
  use tauri::Manager;
  use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2, ICoreWebView2ProcessFailedEventArgs2, COREWEBVIEW2_PROCESS_FAILED_KIND,
    COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED, COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_UNRESPONSIVE,
  };
  use webview2_com::{take_pwstr, ExecuteScriptCompletedHandler, ProcessFailedEventHandler};
  use windows_core::{Interface, PCWSTR, PWSTR};

  static RECOVERIES: Mutex<Option<Recoveries>> = Mutex::new(None);
  /// The page's address when watching began: where safe mode goes if WebView2 can't say where the page was.
  static START_URL: Mutex<Option<String>> = Mutex::new(None);
  /// The last unresponsive report, if the page has not been recovered since.
  static LAST_UNRESPONSIVE: Mutex<HangWatch> = Mutex::new(HangWatch { open: None });

  /// Hooks `ProcessFailed` on the main window's WebView2.
  pub fn start(app: &tauri::AppHandle) {
    if disabled() {
      log::info!("crash recovery: off (MC_DISABLE_CRASH_RECOVERY=1)");
      return;
    }
    let Some(window) = app.get_webview_window("main") else {
      log::warn!("crash recovery: no main window to watch");
      return;
    };
    if let Ok(url) = window.url() {
      *START_URL.lock().unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(url.to_string());
    }
    let result = window.with_webview(|webview| {
      let core = match unsafe { webview.controller().CoreWebView2() } {
        Ok(core) => core,
        Err(error) => return log::warn!("crash recovery: no WebView2 to watch: {error}"),
      };
      let handler = ProcessFailedEventHandler::create(Box::new(|sender, args| {
        let (Some(core), Some(args)) = (sender, args) else {
          return Ok(());
        };
        let mut kind = COREWEBVIEW2_PROCESS_FAILED_KIND::default();
        unsafe { args.ProcessFailedKind(&mut kind)? };
        if kind == COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_UNRESPONSIVE {
          let now = Instant::now();
          let hung = LAST_UNRESPONSIVE.lock().unwrap_or_else(|poisoned| poisoned.into_inner()).report(now);
          if !hung {
            log::warn!("crash recovery: the page is not responding; waiting to see if it comes back");
            // A probe the page answers only once its main thread runs again: an answer clears this report, so a second
            // report later is a new episode, not proof of one long hang. A page still hung never answers.
            let probe = ExecuteScriptCompletedHandler::create(Box::new(move |status, _| {
              // A failed run (E_FAIL when a navigation cut it off) is no sign the page answered.
              if status.is_err() {
                return Ok(());
              }
              if LAST_UNRESPONSIVE.lock().unwrap_or_else(|poisoned| poisoned.into_inner()).answered(now) {
                log::info!("crash recovery: the page is responding again");
              }
              Ok(())
            }));
            let script: Vec<u16> = "0".encode_utf16().chain(std::iter::once(0)).collect();
            if let Err(error) = unsafe { core.ExecuteScript(PCWSTR::from_raw(script.as_ptr()), &probe) } {
              log::warn!("crash recovery: could not probe the page: {error}");
            }
            return Ok(());
          }
          recover(&core, None);
          return Ok(());
        }
        // Otherwise only the page's own process exiting: a GPU process crash shows in the page as a lost WebGL context
        // (ui/startup-watchdog.ts), a frame's process only hosts iframes, and a browser process crash takes the whole
        // WebView2 with it.
        if kind != COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED {
          log::warn!("crash recovery: WebView2 process failed (kind {}); left to WebView2", kind.0);
          return Ok(());
        }
        let mut exit_code = 0i32;
        if let Ok(args2) = args.cast::<ICoreWebView2ProcessFailedEventArgs2>() {
          let _ = unsafe { args2.ExitCode(&mut exit_code) };
        }
        recover(&core, Some(exit_code));
        Ok(())
      }));
      let mut token = 0i64;
      if let Err(error) = unsafe { core.add_ProcessFailed(&handler, &mut token) } {
        log::warn!("crash recovery: could not watch the page: {error}");
      }
    });
    if let Err(error) = result {
      log::warn!("crash recovery: could not reach the webview: {error}");
    }
  }

  /// `exit_code` is None for a hang rather than an exit.
  fn recover(core: &ICoreWebView2, exit_code: Option<i32>) {
    LAST_UNRESPONSIVE.lock().unwrap_or_else(|poisoned| poisoned.into_inner()).clear();
    let decision = RECOVERIES
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner())
      .get_or_insert_with(Recoveries::default)
      .on_crash(Instant::now());
    // The exit code as Windows writes it (0x80000003 is STATUS_BREAKPOINT), or "hung".
    let code = match exit_code {
      Some(code) => format!("{:#010x}", code as u32),
      None => "hung".to_string(),
    };
    match decision {
      Recovery::Reload => {
        log::warn!("crash recovery: the page's process exited or hung ({code}); reloading the page");
        if let Err(error) = unsafe { core.Reload() } {
          // No new event is promised after a refused reload, so go straight on to safe mode rather than wait.
          log::warn!("crash recovery: reload failed ({error}); trying safe mode now");
          RECOVERIES
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .get_or_insert_with(Recoveries::default)
            .escalated(Instant::now());
          safe_mode(core, &code);
        }
      }
      Recovery::SafeMode => safe_mode(core, &code),
      Recovery::GiveUp => {
        log::error!("crash recovery: the page failed again in safe mode ({code}); leaving it as it is");
      }
    }
  }

  /// Loads the page with the Canvas renderer; if WebView2 refuses that, loads the start address as a last try.
  fn safe_mode(core: &ICoreWebView2, code: &str) {
    let start = START_URL.lock().unwrap_or_else(|poisoned| poisoned.into_inner()).clone();
    let start = start.unwrap_or_else(|| "http://tauri.localhost/".to_string());
    let mut source = PWSTR::null();
    let current = match unsafe { core.Source(&mut source) } {
      Ok(()) => take_pwstr(source),
      Err(_) => String::new(),
    };
    let url = safe_mode_url(if current.is_empty() { &start } else { &current });
    log::warn!("crash recovery: the page failed again ({code}); loading it in safe mode: {url}");
    if let Err(error) = navigate(core, &url) {
      log::warn!("crash recovery: safe mode load failed ({error}); loading the start address instead");
      if let Err(error) = navigate(core, &safe_mode_url(&start)) {
        log::error!("crash recovery: could not load the page at all ({error}); leaving it as it is");
      }
    }
  }

  fn navigate(core: &ICoreWebView2, url: &str) -> windows_core::Result<()> {
    let wide: Vec<u16> = url.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe { core.Navigate(PCWSTR::from_raw(wide.as_ptr())) }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn the_first_crash_reloads() {
    let mut recoveries = Recoveries::default();
    assert_eq!(recoveries.on_crash(Instant::now()), Recovery::Reload);
  }

  #[test]
  fn a_crash_right_after_a_reload_goes_to_safe_mode_then_gives_up() {
    let start = Instant::now();
    let mut recoveries = Recoveries::default();
    assert_eq!(recoveries.on_crash(start), Recovery::Reload);
    assert_eq!(recoveries.on_crash(start + Duration::from_secs(5)), Recovery::SafeMode);
    assert_eq!(recoveries.on_crash(start + Duration::from_secs(10)), Recovery::GiveUp);
    assert_eq!(recoveries.on_crash(start + Duration::from_secs(20)), Recovery::GiveUp);
  }

  #[test]
  fn a_crash_after_a_refused_reload_went_to_safe_mode_gives_up() {
    let start = Instant::now();
    let mut recoveries = Recoveries::default();
    assert_eq!(recoveries.on_crash(start), Recovery::Reload);
    recoveries.escalated(start); // Reload was refused: safe mode was loaded straight away
    assert_eq!(recoveries.on_crash(start + Duration::from_secs(5)), Recovery::GiveUp);
  }

  #[test]
  fn a_crash_long_after_the_last_recovery_starts_over() {
    let start = Instant::now();
    let mut recoveries = Recoveries::default();
    recoveries.on_crash(start);
    recoveries.on_crash(start + Duration::from_secs(5));
    let later = start + Duration::from_secs(5) + CRASH_AGAIN_WINDOW;
    assert_eq!(recoveries.on_crash(later), Recovery::Reload);
  }

  #[test]
  fn two_unresponsive_reports_with_no_answer_between_are_a_hang() {
    let start = Instant::now();
    let mut watch = HangWatch::default();
    assert!(!watch.report(start));
    assert!(watch.report(start + Duration::from_secs(5)));
  }

  #[test]
  fn an_answer_between_two_reports_makes_them_separate_slow_moments() {
    let start = Instant::now();
    let mut watch = HangWatch::default();
    assert!(!watch.report(start));
    assert!(watch.answered(start)); // the page ran the probe: it came back
    assert!(!watch.report(start + Duration::from_secs(10)));
  }

  #[test]
  fn reports_far_apart_with_no_answer_between_are_still_a_hang() {
    let start = Instant::now();
    let mut watch = HangWatch::default();
    assert!(!watch.report(start));
    assert!(watch.report(start + Duration::from_secs(90))); // a busy system: the second report came late
  }

  #[test]
  fn an_answer_to_a_report_already_recovered_from_clears_nothing_new() {
    let start = Instant::now();
    let mut watch = HangWatch::default();
    watch.report(start);
    watch.clear(); // recovered
    let next = start + Duration::from_secs(40);
    assert!(!watch.report(next));
    assert!(!watch.answered(start)); // the old probe answering late is not the new episode's answer
    assert!(watch.report(next + Duration::from_secs(5)));
  }

  #[test]
  fn safe_mode_url_adds_the_canvas_renderer() {
    assert_eq!(safe_mode_url("http://tauri.localhost/"), "http://tauri.localhost/?renderer=canvas");
    assert_eq!(safe_mode_url("http://tauri.localhost/?lang=es"), "http://tauri.localhost/?lang=es&renderer=canvas");
    assert_eq!(
      safe_mode_url("http://tauri.localhost/?renderer=webgl&x=1#replay=abc"),
      "http://tauri.localhost/?x=1&renderer=canvas#replay=abc"
    );
  }
}
