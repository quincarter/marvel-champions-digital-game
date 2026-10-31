//! The Install for Steam scripts (scripts/<os>/install-for-steam.*) record an
//! install in a hidden folder in the player's home, `~/.marvel-champions/`:
//! `install.json`, and a copy of the script. This reads the record, so the game
//! can say how it was installed, and runs that copy to update the game
//! (src/platform/steam-install.ts).
//!
//! The update runs with no terminal, because a Steam Deck in Game Mode has none,
//! and its output goes to `update.log` in the same folder for the game to show.
//! It downloads first and then waits for the game to exit, because Windows can't
//! replace a running exe and every system is better off not swapping the game
//! out from under itself. It is its own process group and outlives the game.

use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

const STATE_FOLDER: &str = ".marvel-champions";
const MARKER_FILE: &str = "install.json";
const LOG_FILE: &str = "update.log";
const METHOD: &str = "steam-script";
#[cfg(windows)]
const SCRIPT_FILE: &str = "install-for-steam.ps1";
#[cfg(not(windows))]
const SCRIPT_FILE: &str = "install-for-steam.sh";
/// Enough of the log for the last lines and curl's latest progress.
const LOG_TAIL_BYTES: u64 = 4096;

/// The running update, kept to ask whether it has finished.
static UPDATE: Mutex<Option<Child>> = Mutex::new(None);

#[derive(Deserialize)]
struct Marker {
  method: String,
  game: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamInstall {
  /// False when the script's copy is gone: the game can say how it was
  /// installed, but has nothing to run.
  can_update: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamUpdateStatus {
  running: bool,
  exit_code: Option<i32>,
  log: String,
}

/// Whether the record describes the running game. `game` is the installed
/// AppImage or exe, or on macOS the .app the running exe sits inside. A second
/// copy of the game on the same machine isn't the one the script looks after.
fn is_this_game(game: &str, running: &str) -> bool {
  if game.is_empty() {
    return false;
  }
  if cfg!(windows) {
    Path::new(&running.to_lowercase()).starts_with(game.to_lowercase())
  } else {
    Path::new(running).starts_with(game)
  }
}

fn parse_marker(text: &str) -> Option<Marker> {
  // PowerShell 5.1's file writers can start UTF-8 with a byte order mark.
  serde_json::from_str::<Marker>(text.trim_start_matches('\u{feff}'))
    .ok()
    .filter(|marker| marker.method == METHOD)
}

fn state_dir(app: &AppHandle) -> Result<PathBuf, String> {
  Ok(app.path().home_dir().map_err(|e| e.to_string())?.join(STATE_FOLDER))
}

/// The AppImage the player launched, which `current_exe` isn't: that is a path
/// inside the AppImage's own mount.
fn running_game() -> Option<String> {
  if let Some(appimage) = std::env::var_os("APPIMAGE") {
    return Some(appimage.to_string_lossy().into_owned());
  }
  Some(std::env::current_exe().ok()?.to_string_lossy().into_owned())
}

/// The record of this install, or `None` for a game installed any other way.
#[tauri::command]
pub fn steam_install_info(app: AppHandle) -> Option<SteamInstall> {
  let dir = state_dir(&app).ok()?;
  let marker = parse_marker(&std::fs::read_to_string(dir.join(MARKER_FILE)).ok()?)?;
  if !is_this_game(&marker.game, &running_game()?) {
    return None;
  }
  Some(SteamInstall { can_update: dir.join(SCRIPT_FILE).is_file() })
}

#[cfg(windows)]
fn script_command(script: &Path, language: &str) -> Command {
  use std::os::windows::process::CommandExt;
  const CREATE_NO_WINDOW: u32 = 0x0800_0000;
  let mut command = Command::new("powershell.exe");
  command
    .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File"])
    .arg(script)
    .args(["-Update", "-Language", language, "-WaitPid"])
    .arg(std::process::id().to_string())
    .creation_flags(CREATE_NO_WINDOW);
  command
}

#[cfg(not(windows))]
fn script_command(script: &Path, language: &str) -> Command {
  use std::os::unix::process::CommandExt;
  let mut command = Command::new("bash");
  command
    .arg(script)
    .args(["--update", "--language", language, "--wait-pid"])
    .arg(std::process::id().to_string())
    .process_group(0);
  // What the AppImage and Steam set up for the game would load the wrong
  // libraries into the script's curl and python3.
  for name in ["LD_LIBRARY_PATH", "LD_PRELOAD", "PYTHONHOME", "PYTHONPATH", "PERLLIB", "PERL5LIB"] {
    command.env_remove(name);
  }
  command
}

/// Starts the update, or does nothing while one is already running (the player
/// closed the panel and opened it again).
#[tauri::command]
pub fn steam_update_start(app: AppHandle, language: String) -> Result<(), String> {
  if language.len() != 2 || !language.bytes().all(|b| b.is_ascii_lowercase()) {
    return Err(format!("not a language: {language}"));
  }
  let mut update = UPDATE.lock().map_err(|e| e.to_string())?;
  if let Some(child) = update.as_mut() {
    if matches!(child.try_wait(), Ok(None)) {
      return Ok(());
    }
  }
  let dir = state_dir(&app)?;
  let script = dir.join(SCRIPT_FILE);
  if !script.is_file() {
    return Err(format!("{} is missing", script.display()));
  }
  let log = File::create(dir.join(LOG_FILE)).map_err(|e| e.to_string())?;
  let errors = log.try_clone().map_err(|e| e.to_string())?;
  let child = script_command(&script, &language)
    // Not the AppImage's mount, which has to go away when the game exits.
    .current_dir(&dir)
    .stdin(Stdio::null())
    .stdout(log)
    .stderr(errors)
    .spawn()
    .map_err(|e| e.to_string())?;
  *update = Some(child);
  Ok(())
}

fn log_tail(path: &Path) -> String {
  let Ok(mut file) = File::open(path) else {
    return String::new();
  };
  let length = file.metadata().map(|m| m.len()).unwrap_or(0);
  let _ = file.seek(SeekFrom::Start(length.saturating_sub(LOG_TAIL_BYTES)));
  let mut bytes = Vec::new();
  let _ = file.read_to_end(&mut bytes);
  String::from_utf8_lossy(&bytes).into_owned()
}

#[tauri::command]
pub fn steam_update_status(app: AppHandle) -> Result<SteamUpdateStatus, String> {
  let mut update = UPDATE.lock().map_err(|e| e.to_string())?;
  let (running, exit_code) = match update.as_mut().map(Child::try_wait) {
    Some(Ok(None)) => (true, None),
    Some(Ok(Some(status))) => (false, status.code()),
    Some(Err(e)) => return Err(e.to_string()),
    None => (false, None),
  };
  Ok(SteamUpdateStatus { running, exit_code, log: log_tail(&state_dir(&app)?.join(LOG_FILE)) })
}

/// The panel's Quit and update: the script is waiting for this process to end.
#[tauri::command]
pub fn steam_update_quit(app: AppHandle) {
  app.exit(0);
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn the_record_names_the_game_running() {
    assert!(is_this_game("/home/q/Applications/MarvelChampions/MarvelChampions.AppImage", "/home/q/Applications/MarvelChampions/MarvelChampions.AppImage"));
    assert!(!is_this_game("/home/q/Applications/MarvelChampions/MarvelChampions.AppImage", "/usr/bin/marvel-champions"));
    assert!(!is_this_game("", "/usr/bin/marvel-champions"));
  }

  #[test]
  #[cfg(not(windows))]
  fn a_mac_record_names_the_app_around_the_running_exe() {
    let exe = "/Applications/Marvel Champions.app/Contents/MacOS/marvel-champions";
    assert!(is_this_game("/Applications/Marvel Champions.app", exe));
    assert!(!is_this_game("/Applications/Marvel", exe));
  }

  #[test]
  #[cfg(windows)]
  fn a_windows_record_ignores_case() {
    assert!(is_this_game("G:\\MarvelChampions\\marvel-champions.exe", "g:\\marvelchampions\\Marvel-Champions.exe"));
  }

  #[test]
  fn only_a_script_record_counts() {
    assert!(parse_marker(r#"{"method":"steam-script","game":"/g"}"#).is_some());
    assert!(parse_marker("\u{feff}{\"method\":\"steam-script\",\"game\":\"/g\"}").is_some());
    assert!(parse_marker(r#"{"method":"other","game":"/g"}"#).is_none());
    assert!(parse_marker("not json").is_none());
  }
}
