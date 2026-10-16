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

  /// The monitor switched (its device name) and the mode it was switched to, while one is in effect or wanted.
  struct State {
    device: Vec<u16>,
    mode: Mode,
    active: bool,
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

  /// Switches now when the game has focus; otherwise (a locked screen, another app in front) only once it gets focus.
  pub fn set(hwnd: *mut core::ffi::c_void, mode: Mode, focused: bool) -> Result<(), String> {
    let device = device_of(hwnd).ok_or("no monitor for the window")?;
    let mut state = STATE.lock().unwrap();
    if let Some(previous) = state.as_ref() {
      if previous.device != device && previous.active {
        restore_device(&previous.device);
      }
    }
    if focused {
      switch(&device, mode)?;
    }
    *state = Some(State { device, mode, active: focused });
    Ok(())
  }

  /// Leaves exclusive fullscreen for good: the user's own mode back, nothing wanted any more.
  pub fn restore() {
    let mut state = STATE.lock().unwrap();
    if let Some(previous) = state.take() {
      if previous.active {
        restore_device(&previous.device);
      }
    }
  }

  /// Alt+Tab and back: the user's own mode while the game is in the background, the chosen one again on return.
  pub fn on_focus(focused: bool) {
    let mut state = STATE.lock().unwrap();
    if let Some(current) = state.as_mut() {
      if focused && !current.active {
        current.active = switch(&current.device, current.mode).is_ok();
      } else if !focused && current.active {
        restore_device(&current.device);
        current.active = false;
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
    let focused = window.is_focused().unwrap_or(true);
    win::set(hwnd.0 as *mut core::ffi::c_void, Mode { width, height }, focused)
  }
  #[cfg(not(windows))]
  {
    let _ = (window, width, height);
    Err("display modes can only be changed on Windows".into())
  }
}

#[tauri::command]
pub fn restore_display_mode() {
  restore();
}

pub fn restore() {
  #[cfg(windows)]
  win::restore();
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
