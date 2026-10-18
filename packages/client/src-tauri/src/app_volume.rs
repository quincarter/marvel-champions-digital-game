//! The game's own volume in the Windows volume mixer (#243). The music player's slider and Settings' Music volume row
//! read and set it, so the two always agree: a change in the mixer shows in the game and a change in the game shows in
//! the mixer. It is the game's entry there, never the computer's master volume.
//!
//! The game's sound plays through WebView2, whose processes are children of this one, so every audio session on the
//! default output device whose process is this one or a descendant is the game's. Those sessions belong to WebView2's
//! own audio process, so Windows would list them in the mixer as "Microsoft Edge WebView2" with Edge's icon; each one is
//! named and iconed as the game when it is found, so the mixer shows Marvel Champions. Elsewhere (macOS, Linux) there is no
//! such mixer here: `app_volume` answers `None` and the game keeps its own in-game music volume.

#[cfg(windows)]
mod imp {
  use std::collections::{HashMap, HashSet};
  use windows::core::{Interface, HSTRING};
  use windows::Win32::Foundation::CloseHandle;
  use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
  use windows::Win32::Media::Audio::{
    eConsole, eRender, IAudioSessionControl2, IAudioSessionManager2, IMMDeviceEnumerator, ISimpleAudioVolume,
    MMDeviceEnumerator,
  };
  use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED};
  use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
  };

  /// This process and every process descended from it (the WebView2 browser, renderers and audio service).
  fn family() -> HashSet<u32> {
    let me = std::process::id();
    let mut parents = HashMap::new();
    unsafe {
      if let Ok(snapshot) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) {
        let mut entry = PROCESSENTRY32W { dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32, ..Default::default() };
        if Process32FirstW(snapshot, &mut entry).is_ok() {
          loop {
            parents.insert(entry.th32ProcessID, entry.th32ParentProcessID);
            if Process32NextW(snapshot, &mut entry).is_err() {
              break;
            }
          }
        }
        let _ = CloseHandle(snapshot);
      }
    }
    let descends = |pid: u32| {
      // Bounded: a recycled pid can make the parent links loop.
      let mut at = pid;
      for _ in 0..32 {
        if at == me {
          return true;
        }
        match parents.get(&at) {
          Some(&parent) if parent != at && parent != 0 => at = parent,
          _ => return false,
        }
      }
      false
    };
    let mut ours: HashSet<u32> = parents.keys().copied().filter(|&pid| descends(pid)).collect();
    ours.insert(me);
    ours
  }

  /// The game's audio sessions on the default output device; empty until the game has made a sound.
  fn sessions() -> windows::core::Result<Vec<ISimpleAudioVolume>> {
    unsafe {
      // Commands run on a worker thread; one already set up for COM keeps its own apartment.
      let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
      let devices: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
      let device = devices.GetDefaultAudioEndpoint(eRender, eConsole)?;
      let manager: IAudioSessionManager2 = device.Activate(CLSCTX_ALL, None)?;
      let list = manager.GetSessionEnumerator()?;
      let ours = family();
      let mut found = Vec::new();
      for index in 0..list.GetCount()? {
        let control = list.GetSession(index)?;
        let Ok(control2) = control.cast::<IAudioSessionControl2>() else { continue };
        let Ok(pid) = control2.GetProcessId() else { continue };
        if ours.contains(&pid) {
          // The game's own name and icon in the mixer, not WebView2's. Best effort: a refusal leaves it as it was.
          let _ = control.SetDisplayName(&HSTRING::from("Marvel Champions"), std::ptr::null());
          if let Ok(exe) = std::env::current_exe() {
            let _ = control.SetIconPath(&HSTRING::from(format!("{},0", exe.display())), std::ptr::null());
          }
          found.push(control.cast::<ISimpleAudioVolume>()?);
        }
      }
      Ok(found)
    }
  }

  /// Whether the computer's own volume (the default output device's) is muted.
  pub fn master_muted() -> Option<bool> {
    unsafe {
      let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
      let devices: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok()?;
      let device = devices.GetDefaultAudioEndpoint(eRender, eConsole).ok()?;
      let endpoint: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None).ok()?;
      endpoint.GetMute().ok().map(|muted| muted.as_bool())
    }
  }

  pub fn get() -> Option<f32> {
    let found = sessions().ok()?;
    let first = found.first()?;
    unsafe { first.GetMasterVolume().ok() }
  }

  pub fn set(level: f32) -> Result<bool, String> {
    let found = sessions().map_err(|error| error.to_string())?;
    for volume in &found {
      unsafe { volume.SetMasterVolume(level.clamp(0.0, 1.0), std::ptr::null()) }.map_err(|error| error.to_string())?;
    }
    Ok(!found.is_empty())
  }
}

/// The game's volume in the Windows mixer, 0 to 1, or `None` off Windows or before the game has made a sound.
#[tauri::command]
pub async fn app_volume() -> Option<f32> {
  #[cfg(windows)]
  {
    imp::get()
  }
  #[cfg(not(windows))]
  {
    None
  }
}

/// Whether the computer's master volume is muted (the music pauses while it is), or `None` off Windows.
#[tauri::command]
pub async fn master_muted() -> Option<bool> {
  #[cfg(windows)]
  {
    imp::master_muted()
  }
  #[cfg(not(windows))]
  {
    None
  }
}

/// Sets the game's volume in the Windows mixer, 0 to 1. False when there is nothing to set (off Windows, or no sound
/// yet).
#[tauri::command]
pub async fn set_app_volume(level: f32) -> Result<bool, String> {
  #[cfg(windows)]
  {
    imp::set(level)
  }
  #[cfg(not(windows))]
  {
    let _ = level;
    Ok(false)
  }
}
