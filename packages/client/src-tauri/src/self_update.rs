//! The game's own updater, for an install from the release's installers rather
//! than the Install for Steam script (issue #843): it downloads the new
//! release's installer for this install, waits for the game to quit, installs
//! it and starts the game again (src/platform/self-update.ts).
//!
//! It runs like the Steam script's update (steam_install.rs), so the same panel
//! and status call follow it: a helper script carried in this binary
//! (scripts/update/update-game.*) is written to `~/.marvel-champions/` and run
//! with no window, in its own process group so it outlives the game, with its
//! output in `update.log`.
//!
//! Which installs can: the per-user Setup.exe and the per-machine .msi (Windows
//! asks for an administrator's permission to install that one), a .dmg's app
//! in a folder the player can write to, and an AppImage in one. A .deb or .rpm
//! is the system's package to replace, with an administrator's password, and
//! the game keeps linking those downloads instead.

use crate::steam_install::{running_game, spawn_update, state_dir};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::AppHandle;

/// Only this repo's release downloads are run: the URL comes from the page.
const RELEASE_DOWNLOADS: &str = "https://github.com/quincarter/marvel-champions-digital-game/releases/download/";

#[cfg(windows)]
const HELPER: &str = include_str!("../../../../scripts/update/update-game.ps1");
#[cfg(windows)]
const HELPER_FILE: &str = "update-game.ps1";
#[cfg(not(windows))]
const HELPER: &str = include_str!("../../../../scripts/update/update-game.sh");
#[cfg(not(windows))]
const HELPER_FILE: &str = "update-game.sh";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SelfUpdate {
  /// The installer kind it updates with (`installer_kind`).
  kind: &'static str,
}

/// The file name ending of each kind's installer in a release, as the release
/// workflow names them (scripts/lib/release-collector.mjs).
fn installer_suffix(kind: &str) -> Option<&'static str> {
  match kind {
    "nsis" => Some("-Windows-x64-Setup.exe"),
    "msi" => Some("-Windows-x64-AllUsers.msi"),
    "dmg-aarch64" => Some("-macOS-AppleSilicon-arm64.dmg"),
    "dmg-x64" => Some("-macOS-Intel-x64.dmg"),
    "appimage" => Some("-Linux-x64.AppImage"),
    _ => None,
  }
}

/// Whether `url` is one of this repo's release downloads, and the installer
/// for `kind`: a plain file name with nothing to smuggle into a command line.
fn is_installer_url(url: &str, kind: &str) -> bool {
  let (Some(rest), Some(suffix)) = (url.strip_prefix(RELEASE_DOWNLOADS), installer_suffix(kind)) else {
    return false;
  };
  let mut parts = rest.split('/');
  let (Some(tag), Some(file), None) = (parts.next(), parts.next(), parts.next()) else {
    return false;
  };
  let plain = |text: &str| !text.is_empty() && text.bytes().all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b));
  plain(tag) && plain(file) && file.starts_with("MarvelChampions-") && file.ends_with(suffix)
}

fn is_version(text: &str) -> bool {
  let parts: Vec<&str> = text.split('.').collect();
  parts.len() == 3 && parts.iter().all(|p| !p.is_empty() && p.bytes().all(|b| b.is_ascii_digit()))
}

/// What the helper replaces: the exe on Windows, the .app around the running
/// exe on macOS, the AppImage the player launched on Linux.
fn game_path() -> Option<PathBuf> {
  let running = PathBuf::from(running_game()?);
  if cfg!(target_os = "macos") {
    return running.ancestors().find(|p| p.extension().is_some_and(|e| e == "app")).map(Path::to_path_buf);
  }
  Some(running)
}

/// Whether a file can be made beside `game`, where the new one goes. Windows'
/// installers put the game back where they keep it, so only the other systems
/// ask.
fn can_replace(game: &Path) -> bool {
  if cfg!(windows) {
    return true;
  }
  let Some(parent) = game.parent() else {
    return false;
  };
  let probe = parent.join(format!(".mc-update-probe-{}", std::process::id()));
  let made = std::fs::File::create(&probe).is_ok();
  let _ = std::fs::remove_file(&probe);
  made
}

/// The update this install can make itself, or `None`: run from a .deb or
/// .rpm, from a folder it can't write to, or a build no installer made (dev).
#[tauri::command]
pub fn self_update_info() -> Option<SelfUpdate> {
  let kind = crate::detect_installer_kind();
  installer_suffix(kind)?;
  if cfg!(debug_assertions) {
    return None;
  }
  let game = game_path()?;
  can_replace(&game).then_some(SelfUpdate { kind })
}

#[cfg(windows)]
fn helper_command(helper: &Path, url: &str, kind: &str, version: &str, game: &Path) -> Command {
  use std::os::windows::process::CommandExt;
  const CREATE_NO_WINDOW: u32 = 0x0800_0000;
  let mut command = Command::new("powershell.exe");
  command
    .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File"])
    .arg(helper)
    .args(["-Url", url, "-Kind", kind, "-Version", version, "-Game"])
    .arg(game)
    .arg("-WaitPid")
    .arg(std::process::id().to_string())
    .creation_flags(CREATE_NO_WINDOW);
  command
}

#[cfg(not(windows))]
fn helper_command(helper: &Path, url: &str, kind: &str, version: &str, game: &Path) -> Command {
  use std::os::unix::process::CommandExt;
  let mut command = Command::new("bash");
  let kind = if kind == "appimage" { "appimage" } else { "dmg" };
  command
    .arg(helper)
    .args([url, kind, version])
    .arg(game)
    .arg(std::process::id().to_string())
    .process_group(0);
  // What the AppImage set up for the game would load the wrong libraries into the helper's curl.
  for name in ["LD_LIBRARY_PATH", "LD_PRELOAD", "PYTHONHOME", "PYTHONPATH", "PERLLIB", "PERL5LIB"] {
    command.env_remove(name);
  }
  command
}

/// Starts the update to `version` from `url`, this install's installer in that
/// release, or carries on with the one already running.
#[tauri::command]
pub fn self_update_start(app: AppHandle, url: String, version: String) -> Result<(), String> {
  let kind = self_update_info().ok_or("this install can't update itself")?.kind;
  if !is_installer_url(&url, kind) {
    return Err(format!("not this install's installer: {url}"));
  }
  if !is_version(&version) {
    return Err(format!("not a version: {version}"));
  }
  let game = game_path().ok_or("couldn't find the game")?;
  let dir = state_dir(&app)?;
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let helper = dir.join(HELPER_FILE);
  std::fs::write(&helper, HELPER).map_err(|e| e.to_string())?;
  spawn_update(&dir, || helper_command(&helper, &url, kind, &version, &game))
}

#[cfg(test)]
mod tests {
  use super::*;

  const BASE: &str = "https://github.com/quincarter/marvel-champions-digital-game/releases/download/v1.2.3/";

  #[test]
  fn only_this_installs_own_installer_in_a_release_is_run() {
    assert!(is_installer_url(&format!("{BASE}MarvelChampions-1.2.3-EN-Windows-x64-Setup.exe"), "nsis"));
    assert!(is_installer_url(&format!("{BASE}MarvelChampions-1.2.3-ES-Windows-x64-AllUsers.msi"), "msi"));
    assert!(is_installer_url(&format!("{BASE}MarvelChampions-1.2.3-EN-Linux-x64.AppImage"), "appimage"));
    assert!(is_installer_url(&format!("{BASE}MarvelChampions-1.2.3-EN-macOS-AppleSilicon-arm64.dmg"), "dmg-aarch64"));
    // Another kind's installer, a .deb, another repo, a path that climbs, or anything a shell would read.
    assert!(!is_installer_url(&format!("{BASE}MarvelChampions-1.2.3-EN-Windows-x64-AllUsers.msi"), "nsis"));
    assert!(!is_installer_url(&format!("{BASE}MarvelChampions-1.2.3-EN-Linux-x64.deb"), "deb"));
    assert!(!is_installer_url(
      "https://github.com/someone/else/releases/download/v1/MarvelChampions-1-EN-Linux-x64.AppImage",
      "appimage"
    ));
    assert!(!is_installer_url(&format!("{BASE}../x/MarvelChampions-1.2.3-EN-Linux-x64.AppImage"), "appimage"));
    assert!(!is_installer_url(&format!("{BASE}MarvelChampions-$(x)-EN-Linux-x64.AppImage"), "appimage"));
  }

  #[test]
  fn a_version_is_three_numbers() {
    assert!(is_version("0.50.0"));
    assert!(!is_version("0.50"));
    assert!(!is_version("0.50.0; rm"));
    assert!(!is_version("v0.50.0"));
  }
}
