//! Exclusive fullscreen on Windows: the Fullscreen window mode at a resolution
//! other than native really switches the monitor's display mode
//! (src/platform/desktop-window.ts). Tauri has no API for it, so this calls
//! Win32 directly.
//!
//! The switch is made with `CDS_FULLSCREEN`, a temporary mode that is never
//! written to the registry: Windows puts the monitor back to the user's own
//! (registry) mode when this process exits, a crash included (checked on
//! Windows 11: killing the process restored the monitor within a second). On top of that
//! the user's mode is restored explicitly when the game leaves Fullscreen,
//! loses focus (Alt+Tab; the chosen mode comes back with focus) and exits.
//! Elsewhere every command reports nothing to offer.

use serde::Serialize;

#[derive(Serialize, Clone, Copy, PartialEq, Eq)]
pub struct Mode {
  pub width: u32,
  pub height: u32,
}

#[derive(Serialize)]
pub struct DisplayModes {
  /// The user's own mode for this monitor (its registry setting): native.
  pub native: Mode,
  /// Every size the monitor reports, largest first, without duplicates.
  pub modes: Vec<Mode>,
}

#[cfg(windows)]
mod win {
  use super::{DisplayModes, Mode};
  use std::sync::Mutex;
  use windows_sys::Win32::Graphics::Gdi::{
    ChangeDisplaySettingsExW, EnumDisplaySettingsW, GetMonitorInfoW, MonitorFromWindow, CDS_FULLSCREEN,
    DEVMODEW, DISP_CHANGE_SUCCESSFUL, DM_DISPLAYFREQUENCY, DM_PELSHEIGHT, DM_PELSWIDTH, ENUM_REGISTRY_SETTINGS,
    MONITORINFO, MONITORINFOEXW, MONITOR_DEFAULTTONEAREST,
  };
  use windows_sys::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowRect, SetWindowPos, SWP_NOACTIVATE, SWP_NOZORDER};

  /// The monitor switched (its device name) and the mode it was switched to, while one is in effect or wanted.
  struct State {
    /// The game window, as an integer so the state can sit in a static.
    hwnd: isize,
    device: Vec<u16>,
    mode: Mode,
    active: bool,
    /// When the monitor last switched to `mode`: Explorer takes the foreground for a moment after a display change.
    switched_at: Option<std::time::Instant>,
  }

  /// How long after a switch Explorer taking the foreground is the display change, not the player.
  const SHELL_GRACE: std::time::Duration = std::time::Duration::from_secs(4);

  fn foreground_is_shell() -> bool {
    foreground_name().to_ascii_lowercase().ends_with("\\explorer.exe")
  }

  /// Gives the game the foreground back (after Explorer took it in reaction to the display change).
  fn reclaim(hwnd: isize) {
    std::thread::spawn(move || {
      std::thread::sleep(std::time::Duration::from_millis(150));
      unsafe {
        windows_sys::Win32::UI::WindowsAndMessaging::SetForegroundWindow(hwnd as *mut core::ffi::c_void);
      }
    });
  }

  static STATE: Mutex<Option<State>> = Mutex::new(None);

  fn blank_devmode() -> DEVMODEW {
    let mut dm: DEVMODEW = unsafe { std::mem::zeroed() };
    dm.dmSize = std::mem::size_of::<DEVMODEW>() as u16;
    dm
  }

  /// The display device name (`\\.\DISPLAY1`) of the monitor the window is on, NUL-terminated.
  fn device_of(hwnd: *mut core::ffi::c_void) -> Option<Vec<u16>> {
    unsafe {
      let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
      let mut info: MONITORINFOEXW = std::mem::zeroed();
      info.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;
      if GetMonitorInfoW(monitor, &mut info as *mut MONITORINFOEXW as *mut MONITORINFO) == 0 {
        return None;
      }
      let len = info.szDevice.iter().position(|&c| c == 0).unwrap_or(info.szDevice.len());
      let mut name = info.szDevice[..len].to_vec();
      name.push(0);
      Some(name)
    }
  }

  fn all_modes(device: &[u16]) -> Vec<DEVMODEW> {
    let mut out = Vec::new();
    let mut i = 0u32;
    loop {
      let mut dm = blank_devmode();
      if unsafe { EnumDisplaySettingsW(device.as_ptr(), i, &mut dm) } == 0 {
        break;
      }
      // 32-bit colour only: the lower depths are legacy modes no one wants for a game.
      if dm.dmBitsPerPel >= 32 {
        out.push(dm);
      }
      i += 1;
    }
    out
  }

  pub fn modes(hwnd: *mut core::ffi::c_void) -> Option<DisplayModes> {
    let device = device_of(hwnd)?;
    let mut registry = blank_devmode();
    if unsafe { EnumDisplaySettingsW(device.as_ptr(), ENUM_REGISTRY_SETTINGS, &mut registry) } == 0 {
      return None;
    }
    let native = Mode { width: registry.dmPelsWidth, height: registry.dmPelsHeight };
    let mut modes: Vec<Mode> = Vec::new();
    for dm in all_modes(&device) {
      let mode = Mode { width: dm.dmPelsWidth, height: dm.dmPelsHeight };
      if !modes.contains(&mode) {
        modes.push(mode);
      }
    }
    modes.sort_by(|a, b| (b.width * b.height, b.width).cmp(&(a.width * a.height, a.width)));
    Some(DisplayModes { native, modes })
  }

  /// Switches `device` to `mode` at the highest refresh rate it offers for that size.
  fn switch(device: &[u16], mode: Mode) -> Result<(), String> {
    let best = all_modes(device)
      .into_iter()
      .filter(|dm| dm.dmPelsWidth == mode.width && dm.dmPelsHeight == mode.height)
      .max_by_key(|dm| dm.dmDisplayFrequency)
      .ok_or_else(|| format!("{}x{} is not a mode this monitor offers", mode.width, mode.height))?;
    let mut dm = best;
    dm.dmFields = DM_PELSWIDTH | DM_PELSHEIGHT | DM_DISPLAYFREQUENCY;
    let result =
      unsafe { ChangeDisplaySettingsExW(device.as_ptr(), &dm, std::ptr::null_mut(), CDS_FULLSCREEN, std::ptr::null()) };
    if result == DISP_CHANGE_SUCCESSFUL {
      Ok(())
    } else {
      Err(format!("the display mode change was refused ({result})"))
    }
  }

  /// Puts `device` back to its registry (the user's own) mode.
  fn restore_device(device: &[u16]) {
    unsafe {
      ChangeDisplaySettingsExW(device.as_ptr(), std::ptr::null(), std::ptr::null_mut(), 0, std::ptr::null());
    }
  }

  /// Lays the window over its monitor's whole new area. A fullscreen window keeps the size it had when the monitor
  /// changed mode, so without this the game showed a 3440-wide corner on an 800 x 600 screen (the owner, 2026-10-16).
  /// It runs once, after the mode change has settled (it lands asynchronously), so the only flash the player sees is
  /// the monitor's own re-sync: placing the window straight away and again later showed as extra tearing on Alt+Tab
  /// (the owner, 2026-10-16).
  /// The process that owns the foreground window, for the debug log.
  fn foreground_name() -> String {
    use windows_sys::Win32::System::Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION};
    use windows_sys::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId;
    unsafe {
      let hwnd = GetForegroundWindow();
      let mut pid = 0u32;
      GetWindowThreadProcessId(hwnd, &mut pid);
      let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
      if process.is_null() {
        return format!("pid {pid}");
      }
      let mut buf = [0u16; 260];
      let mut len = buf.len() as u32;
      QueryFullProcessImageNameW(process, 0, buf.as_mut_ptr(), &mut len);
      windows_sys::Win32::Foundation::CloseHandle(process);
      String::from_utf16_lossy(&buf[..len as usize])
    }
  }

  /// After the mode has settled, then once more a little later (each a wait from the one before).
  const FIT_CHECKS_MS: [u64; 2] = [300, 900];

  /// Bumped by every fit and every restore: a fit still waiting from an earlier switch must not move a window that has
  /// since become something else (it blew a fresh 1440 x 900 window up to the whole screen).
  static FIT_GENERATION: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

  fn cancel_fits() {
    FIT_GENERATION.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
  }

  fn fit(hwnd: isize) {
    let generation = FIT_GENERATION.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
    let place = move || unsafe {
      if FIT_GENERATION.load(std::sync::atomic::Ordering::SeqCst) != generation {
        return;
      }
      let hwnd = hwnd as *mut core::ffi::c_void;
      let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
      let mut info: MONITORINFO = std::mem::zeroed();
      info.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
      let mut now: windows_sys::Win32::Foundation::RECT = std::mem::zeroed();
      if GetMonitorInfoW(monitor, &mut info) != 0 && GetWindowRect(hwnd, &mut now) != 0 {
        let r = info.rcMonitor;
        // Already in place: moving it again would only repaint (the tearing the owner saw on Alt+Tab).
        if (now.left, now.top, now.right, now.bottom) == (r.left, r.top, r.right, r.bottom) {
          return;
        }
        log::info!("display mode: refit {}x{} to {}x{}", now.right - now.left, now.bottom - now.top, r.right - r.left, r.bottom - r.top);
        SetWindowPos(
          hwnd,
          std::ptr::null_mut(),
          r.left,
          r.top,
          r.right - r.left,
          r.bottom - r.top,
          SWP_NOZORDER | SWP_NOACTIVATE,
        );
      }
    };
    std::thread::spawn(move || {
      // The shell can put its own (pre-switch) fullscreen size back after focus returns, which left a 3440-wide game on
      // a 1920 x 1080 screen now and then (the owner, 2026-10-16); the later check catches that, and moves nothing
      // when the window is already right.
      for delay in FIT_CHECKS_MS {
        std::thread::sleep(std::time::Duration::from_millis(delay));
        place();
      }
    });
  }

  /// Switches now when the game has focus; otherwise (a locked screen, another app in front) only once it gets focus.
  pub fn set(hwnd: *mut core::ffi::c_void, mode: Mode) -> Result<(), String> {
    // The foreground window, not the webview's focus flag: that reads false for a moment while the window leaves
    // fullscreen just before this call, which left the monitor at native after Apply (the owner, 2026-10-16).
    let focused = unsafe { GetForegroundWindow() } == hwnd;
    log::info!("display mode: set {}x{}, in front {focused}", mode.width, mode.height);
    let device = device_of(hwnd).ok_or("no monitor for the window")?;
    let mut state = STATE.lock().unwrap();
    if let Some(previous) = state.as_ref() {
      if previous.device != device && previous.active {
        restore_device(&previous.device);
      }
    }
    if focused {
      switch(&device, mode)?;
      fit(hwnd as isize);
    }
    *state = Some(State {
      hwnd: hwnd as isize,
      device,
      mode,
      active: focused,
      switched_at: focused.then(std::time::Instant::now),
    });
    Ok(())
  }

  /// Leaves exclusive fullscreen for good: the user's own mode back, nothing wanted any more.
  pub fn restore(refit: bool) {
    cancel_fits();
    let mut state = STATE.lock().unwrap();
    if let Some(previous) = state.take() {
      if previous.active {
        restore_device(&previous.device);
        if refit {
          fit(previous.hwnd);
        }
      }
    }
  }

  /// Alt+Tab and back: the user's own mode while the game is in the background, the chosen one again on return.
  pub fn on_focus(focused: bool) {
    let mut state = STATE.lock().unwrap();
    log::info!("display mode: focus {focused}, foreground {}, state {:?}", foreground_name(), state.as_ref().map(|s| (s.mode.width, s.mode.height, s.active)));
    if let Some(current) = state.as_mut() {
      if focused && !current.active {
        let result = switch(&current.device, current.mode);
        log::info!("display mode: switch back {result:?}");
        current.active = result.is_ok();
        if current.active {
          current.switched_at = Some(std::time::Instant::now());
        }
        fit(current.hwnd);
      } else if !focused && current.active {
        // Explorer reacts to the display change by taking the foreground a second or two later; that is not the
        // player switching away, which put their own mode straight back (the owner, 2026-10-16).
        let just_switched = current.switched_at.is_some_and(|at| at.elapsed() < SHELL_GRACE);
        if just_switched && foreground_is_shell() {
          log::info!("display mode: Explorer took the foreground after the switch; taking it back");
          reclaim(current.hwnd);
          return;
        }
        restore_device(&current.device);
        current.active = false;
        fit(current.hwnd);
      }
    }
  }
}

#[tauri::command]
pub fn display_modes(window: tauri::WebviewWindow) -> Option<DisplayModes> {
  #[cfg(windows)]
  {
    let hwnd = window.hwnd().ok()?;
    win::modes(hwnd.0 as *mut core::ffi::c_void)
  }
  #[cfg(not(windows))]
  {
    let _ = window;
    None
  }
}

#[tauri::command]
pub fn set_display_mode(window: tauri::WebviewWindow, width: u32, height: u32) -> Result<(), String> {
  #[cfg(windows)]
  {
    let hwnd = window.hwnd().map_err(|e| e.to_string())?;
    win::set(hwnd.0 as *mut core::ffi::c_void, Mode { width, height })
  }
  #[cfg(not(windows))]
  {
    let _ = (window, width, height);
    Err("display modes can only be changed on Windows".into())
  }
}

#[tauri::command]
/// `fit`: lay the window over the monitor's restored area (staying fullscreen, as Borderless); false when the game is
/// about to become a window of its own size.
pub fn restore_display_mode(fit: bool) {
  restore(fit);
}

pub fn restore(fit: bool) {
  #[cfg(windows)]
  win::restore(fit);
  #[cfg(not(windows))]
  let _ = fit;
}

pub fn on_focus(focused: bool) {
  #[cfg(windows)]
  win::on_focus(focused);
  #[cfg(not(windows))]
  let _ = focused;
}

/// The Linux distribution's `ID` and `ID_LIKE` from /etc/os-release (for example `steamos`, `bazzite`), so the game
/// can default to Fullscreen on a Steam Deck or a Bazzite handheld. Empty elsewhere.
#[tauri::command]
pub fn linux_distro() -> Vec<String> {
  #[cfg(target_os = "linux")]
  {
    let text = std::fs::read_to_string("/etc/os-release")
      .or_else(|_| std::fs::read_to_string("/usr/lib/os-release"))
      .unwrap_or_default();
    text
      .lines()
      .filter_map(|line| line.strip_prefix("ID=").or_else(|| line.strip_prefix("ID_LIKE=")))
      .flat_map(|value| value.trim_matches('"').split_whitespace().map(str::to_ascii_lowercase).collect::<Vec<_>>())
      .collect()
  }
  #[cfg(not(target_os = "linux"))]
  {
    Vec::new()
  }
}
