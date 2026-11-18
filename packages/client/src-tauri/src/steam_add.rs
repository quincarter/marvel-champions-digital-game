//! Add to Steam from the game itself (issue #844): runs the Install for Steam
//! script this build carries (scripts/<os>/install-for-steam.*) to add the
//! running game to the player's Steam library with its art, the way the script
//! does when it's downloaded and run by hand (src/platform/steam-add.ts).
//!
//! It runs like the script's update (steam_install.rs): in the background with
//! no window, output in `~/.marvel-champions/update.log`, so the same panel and
//! status call follow it. It keeps the game as it is (`--keep-game`): adding to
//! Steam never installs another version under the running game. Steam has to be
//! closed while its shortcut list is written, so the script closes it (`--yes`);
//! the panel says so before it starts. Afterwards the script's install record
//! names this game, and its updates go through the script.
//!
//! The button only shows where it can do something: Steam is installed, the
//! game isn't in it yet, and on Linux the game is an AppImage (the script adds
//! an AppImage; a .deb or .rpm install is the system's).

use crate::steam_install::{running_game, spawn_update, state_dir, STEAM_ADD_JOB};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Manager};

/// The script's name for the game's Steam shortcut, and the names it has had.
const SHORTCUT_NAMES: [&str; 2] = ["Marvel Champions Digital Edition", "Marvel Champions"];

#[cfg(windows)]
const SCRIPT: &str = include_str!("../../../../scripts/windows/install-for-steam.ps1");
#[cfg(windows)]
const SCRIPT_FILE: &str = "add-to-steam.ps1";
#[cfg(target_os = "macos")]
const SCRIPT: &str = include_str!("../../../../scripts/macos/install-for-steam.sh");
#[cfg(all(unix, not(target_os = "macos")))]
const SCRIPT: &str = include_str!("../../../../scripts/linux/install-for-steam.sh");
#[cfg(not(windows))]
const SCRIPT_FILE: &str = "add-to-steam.sh";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamAdd {
  /// Always true when there is an answer; the shape leaves room to say why not.
  can_add: bool,
}

/// The Steam folders to look in: the registry's on Windows, else where Steam
/// keeps itself on each system (Flatpak Steam's too).
fn steam_roots(home: &Path) -> Vec<PathBuf> {
  let mut roots = Vec::new();
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let answer = Command::new("reg")
      .args(["query", r"HKCU\Software\Valve\Steam", "/v", "SteamPath"])
      .creation_flags(CREATE_NO_WINDOW)
      .output();
    if let Ok(out) = answer {
      let text = String::from_utf8_lossy(&out.stdout);
      if let Some(path) = text.lines().find_map(|line| line.split("REG_SZ").nth(1)) {
        roots.push(PathBuf::from(path.trim().replace('/', "\\")));
      }
    }
    if let Some(x86) = std::env::var_os("ProgramFiles(x86)") {
      roots.push(PathBuf::from(x86).join("Steam"));
    }
  }
  #[cfg(target_os = "macos")]
  roots.push(home.join("Library/Application Support/Steam"));
  #[cfg(all(unix, not(target_os = "macos")))]
  {
    // In the script's order (scripts/linux/install-for-steam.sh): native Steam first, then the Flatpak's.
    roots.push(home.join(".local/share/Steam"));
    roots.push(home.join(".steam/steam"));
    roots.push(home.join(".steam/root"));
    roots.push(home.join(".var/app/com.valvesoftware.Steam/.local/share/Steam"));
  }
  let _ = home;
  roots
}

/// Every signed-in Steam user's shortcut list under `root`, made or not yet.
fn shortcut_lists(root: &Path) -> Vec<PathBuf> {
  let Ok(users) = std::fs::read_dir(root.join("userdata")) else {
    return Vec::new();
  };
  users
    .flatten()
    .filter(|user| {
      let name = user.file_name();
      let name = name.to_string_lossy();
      name != "0" && !name.is_empty() && name.bytes().all(|b| b.is_ascii_digit())
    })
    .map(|user| user.path().join("config").join("shortcuts.vdf"))
    .collect()
}

/// Whether a shortcut list has this game: an entry named as the script names
/// it, or one pointing at `game` (added by hand). The binary list keeps every
/// string as plain bytes, so a search for them is enough.
fn lists_game(vdf: &[u8], game: &str) -> bool {
  let haystack = String::from_utf8_lossy(vdf).to_lowercase();
  let named = SHORTCUT_NAMES.iter().any(|name| haystack.contains(&format!("\u{1}appname\u{0}{}\u{0}", name.to_lowercase())));
  named || (!game.is_empty() && haystack.contains(&game.to_lowercase()))
}

/// Started by Steam: it sets these for a game it launches, a non-Steam one too.
fn launched_by_steam() -> bool {
  ["SteamGameId", "SteamAppId", "SteamClientLaunch"].iter().any(|name| std::env::var_os(name).is_some_and(|v| !v.is_empty()))
}

/// What the script adds to Steam: the exe on Windows, the .app around it on
/// macOS, the AppImage on Linux (none for a .deb or .rpm install).
fn game_path() -> Option<PathBuf> {
  // Windows: only a game one of the release's installers put there, which the script's updates know how to update
  // (the same provenance check the game's own updater uses). A copied or portable exe keeps its download link.
  if cfg!(windows) && crate::self_update::windows_installer_kind().is_empty() {
    return None;
  }
  if cfg!(all(unix, not(target_os = "macos"))) && std::env::var_os("APPIMAGE").is_none() {
    return None;
  }
  let running = PathBuf::from(running_game()?);
  // The script's updates replace the AppImage in its folder, so one in a folder the player can't write to (/opt, a
  // read-only mount) isn't offered: it could be added, but never updated there.
  if cfg!(all(unix, not(target_os = "macos"))) && !folder_writable(&running) {
    return None;
  }
  if cfg!(target_os = "macos") {
    // Likewise the .app: the script's updates trade it for the new one in one step, which needs a folder the player can
    // write to on a disk that can swap (self_update.rs). Anywhere else it isn't offered.
    let app = running.ancestors().find(|p| p.extension().is_some_and(|e| e == "app"))?.to_path_buf();
    let replaceable = folder_writable(&app) && app.parent().is_some_and(crate::self_update::can_swap_in);
    return replaceable.then_some(app);
  }
  Some(running)
}

fn folder_writable(file: &Path) -> bool {
  let Some(parent) = file.parent() else {
    return false;
  };
  let probe = parent.join(format!(".mc-steam-add-probe-{}", std::process::id()));
  let made = std::fs::File::create(&probe).is_ok();
  let _ = std::fs::remove_file(&probe);
  made
}

/// Whether to offer Add to Steam, or `None` when Steam isn't installed, the
/// game is already in it, or this install can't be added.
#[tauri::command]
pub fn steam_add_info(app: AppHandle) -> Option<SteamAdd> {
  // Not the script's install record: a Steam account signed in since it was written, or a second Steam install, may
  // still lack the game. Every signed-in user's shortcut list (below) is what says whether there is anything to add.
  if cfg!(debug_assertions) || launched_by_steam() {
    return None;
  }
  let game = game_path()?;
  let home = app.path().home_dir().ok()?;
  // The one Steam the script will write to: like the script, the first of these with a signed-in user (on Linux, native
  // Steam over the Flatpak's), so the row never asks for an add the script would make somewhere else.
  let lists: Vec<PathBuf> = steam_roots(&home)
    .iter()
    .find(|root| root.join("userdata").is_dir())
    .map(|root| shortcut_lists(root))
    .unwrap_or_default();
  if lists.is_empty() {
    return None;
  }
  let game = game.to_string_lossy();
  // Every signed-in user's list, since the script adds the game to each: one that stopped partway, or a shortcut added by
  // hand in one account, still offers Add to Steam to finish the rest.
  let listed = lists.iter().all(|list| std::fs::read(list).is_ok_and(|vdf| lists_game(&vdf, &game)));
  (!listed).then_some(SteamAdd { can_add: true })
}

#[cfg(windows)]
fn script_command(script: &Path, game: &Path, language: &str, version: &str) -> Command {
  use std::os::windows::process::CommandExt;
  const CREATE_NO_WINDOW: u32 = 0x0800_0000;
  let mut command = Command::new("powershell.exe");
  command
    .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File"])
    .arg(script)
    .arg("-Path")
    .arg(game)
    .args(["-Language", language, "-KeepGame", version, "-Yes"])
    .creation_flags(CREATE_NO_WINDOW);
  command
}

#[cfg(not(windows))]
fn script_command(script: &Path, game: &Path, language: &str, version: &str) -> Command {
  use std::os::unix::process::CommandExt;
  let mut command = Command::new("bash");
  command.arg(script).args(["--language", language, "--keep-game", version, "--yes"]);
  if cfg!(target_os = "macos") {
    command.arg("--app").arg(game);
  } else {
    command.arg(game);
  }
  command.process_group(0);
  // What the AppImage set up for the game would load the wrong libraries into the script's curl and python3.
  for name in ["LD_LIBRARY_PATH", "LD_PRELOAD", "PYTHONHOME", "PYTHONPATH", "PERLLIB", "PERL5LIB"] {
    command.env_remove(name);
  }
  command
}

/// Starts adding the game to Steam, or carries on with a run already going.
#[tauri::command]
pub fn steam_add_start(app: AppHandle, language: String) -> Result<(), String> {
  if language.len() != 2 || !language.bytes().all(|b| b.is_ascii_lowercase()) {
    return Err(format!("not a language: {language}"));
  }
  let game = game_path().ok_or("this install can't be added to Steam")?;
  let version = app.package_info().version.to_string();
  let dir = state_dir(&app)?;
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let script = dir.join(SCRIPT_FILE);
  std::fs::write(&script, SCRIPT).map_err(|e| e.to_string())?;
  spawn_update(&dir, STEAM_ADD_JOB, || script_command(&script, &game, &language, &version))
}

#[cfg(test)]
mod tests {
  use super::*;

  fn entry(name: &str, exe: &str) -> Vec<u8> {
    let mut bytes = b"\x00shortcuts\x00\x000\x00\x02appid\x00\x01\x02\x03\x04".to_vec();
    bytes.extend_from_slice(format!("\x01AppName\x00{name}\x00\x01Exe\x00\"{exe}\"\x00\x08\x08\x08").as_bytes());
    bytes
  }

  #[test]
  fn a_list_has_the_game_by_the_scripts_name_or_its_path() {
    let exe = r"C:\Users\q\AppData\Local\Marvel Champions\marvel-champions.exe";
    assert!(lists_game(&entry("Marvel Champions Digital Edition", r"D:\elsewhere.exe"), exe));
    assert!(lists_game(&entry("My card game", &exe.to_uppercase()), exe));
    assert!(!lists_game(&entry("Marvel Champions Digital Edition Mod", r"D:\x.exe"), exe));
    assert!(!lists_game(&entry("Slay the Spire", r"D:\sts.exe"), exe));
    assert!(!lists_game(b"", exe));
  }
}
