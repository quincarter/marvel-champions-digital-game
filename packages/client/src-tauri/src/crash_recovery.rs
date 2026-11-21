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
//! A crash after the window has passed starts again at step 1. Every move in the game is already in IndexedDB
//! (`engine/game-storage.ts`), so the reloaded page opens on Title with the game under "Continue". The same idea as the
//! Linux hang watchdog (`hang_watchdog.rs`), for crashes rather than hangs. `MC_DISABLE_CRASH_RECOVERY=1` turns it off.
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
  use super::{disabled, safe_mode_url, Recoveries, Recovery};
  use std::sync::Mutex;
  use std::time::Instant;
  use tauri::Manager;
  use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2, ICoreWebView2ProcessFailedEventArgs2, COREWEBVIEW2_PROCESS_FAILED_KIND,
    COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED,
  };
  use webview2_com::{take_pwstr, ProcessFailedEventHandler};
  use windows_core::{Interface, PCWSTR, PWSTR};

  static RECOVERIES: Mutex<Option<Recoveries>> = Mutex::new(None);

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
        // Only the page's own process: a GPU process crash is recovered by WebView2 itself, and a browser process
        // crash takes the whole WebView2 with it.
        if kind != COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED {
          log::warn!("crash recovery: WebView2 process failed (kind {}); left to WebView2", kind.0);
          return Ok(());
        }
        let mut exit_code = 0i32;
        if let Ok(args2) = args.cast::<ICoreWebView2ProcessFailedEventArgs2>() {
          let _ = unsafe { args2.ExitCode(&mut exit_code) };
        }
        recover(&core, exit_code);
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

  fn recover(core: &ICoreWebView2, exit_code: i32) {
    let decision = RECOVERIES
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner())
      .get_or_insert_with(Recoveries::default)
      .on_crash(Instant::now());
    // The exit code as Windows writes it (0x80000003 is STATUS_BREAKPOINT).
    let code = exit_code as u32;
    match decision {
      Recovery::Reload => {
        log::warn!("crash recovery: the page's process exited ({code:#010x}); reloading the page");
        if let Err(error) = unsafe { core.Reload() } {
          log::warn!("crash recovery: reload failed: {error}");
        }
      }
      Recovery::SafeMode => {
        let mut source = PWSTR::null();
        let current = match unsafe { core.Source(&mut source) } {
          Ok(()) => take_pwstr(source),
          Err(_) => String::new(),
        };
        let url = safe_mode_url(if current.is_empty() { "http://tauri.localhost/" } else { &current });
        log::warn!("crash recovery: the page crashed again ({code:#010x}); loading it in safe mode: {url}");
        let wide: Vec<u16> = url.encode_utf16().chain(std::iter::once(0)).collect();
        if let Err(error) = unsafe { core.Navigate(PCWSTR::from_raw(wide.as_ptr())) } {
          log::warn!("crash recovery: safe mode load failed: {error}");
        }
      }
      Recovery::GiveUp => {
        log::error!("crash recovery: the page crashed again in safe mode ({code:#010x}); leaving the error page up");
      }
    }
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
  fn a_crash_long_after_the_last_recovery_starts_over() {
    let start = Instant::now();
    let mut recoveries = Recoveries::default();
    recoveries.on_crash(start);
    recoveries.on_crash(start + Duration::from_secs(5));
    let later = start + Duration::from_secs(5) + CRASH_AGAIN_WINDOW;
    assert_eq!(recoveries.on_crash(later), Recovery::Reload);
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
