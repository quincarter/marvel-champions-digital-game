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
//! in a folder the player can write to, an AppImage in one, and a .deb or .rpm
//! where polkit's `pkexec` can ask for an administrator's password to install
//! the package. The Android app's update stays a download: Android's own
//! installer has to run it.

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
    "deb" => Some("-Linux-x64.deb"),
    "rpm" => Some("-Linux-x64.rpm"),
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

/// The installer's SHA-256 as GitHub lists it for a release asset (`sha256:<hex>`, or the bare hex).
fn sha256_of(digest: &str) -> Option<&str> {
  let hex = digest.strip_prefix("sha256:").unwrap_or(digest);
  (hex.len() == 64 && hex.bytes().all(|b| b.is_ascii_hexdigit())).then_some(hex)
}

/// The game's entry in Windows' list of installed programs, as `reg query
/// <key>` prints it: where the .msi put the game, if this is the .msi's entry.
fn msi_install_location(entry: &str) -> Option<String> {
  let value = |name: &str| {
    entry.lines().find_map(|line| {
      let line = line.trim();
      let rest = line.strip_prefix(name)?.trim_start();
      let (_type, value) = rest.strip_prefix("REG_")?.split_once(char::is_whitespace)?;
      Some(value.trim().to_owned())
    })
  };
  let msi = value("WindowsInstaller").is_some_and(|v| v == "0x1");
  let location = value("InstallLocation").filter(|v| !v.is_empty())?;
  msi.then_some(location)
}

fn same_folder(a: &Path, b: &Path) -> bool {
  let norm = |p: &Path| p.to_string_lossy().trim_end_matches(['\\', '/']).to_lowercase();
  norm(a) == norm(b)
}

/// Which Windows installer put the running game where it is: the setup.exe
/// leaves its `uninstall.exe` beside the game, and the .msi registers itself
/// with Windows Installer, folder and all. "" when neither says so, and the
/// game links the release page rather than guess which installer to run (a
/// guess from the folder took an .msi in a custom folder for the setup.exe).
pub(crate) fn windows_installer_kind() -> &'static str {
  static KIND: std::sync::OnceLock<&'static str> = std::sync::OnceLock::new();
  KIND.get_or_init(|| {
    let Some(dir) = std::env::current_exe().ok().and_then(|exe| exe.parent().map(Path::to_path_buf)) else {
      return "";
    };
    if dir.join("uninstall.exe").is_file() {
      return "nsis";
    }
    let msi = msi_entries()
      .iter()
      .any(|entry| msi_install_location(entry).is_some_and(|at| same_folder(Path::new(&at), &dir)));
    if msi {
      "msi"
    } else {
      ""
    }
  })
}

/// Each "Marvel Champions" entry among the programs installed for every user,
/// as `reg query` prints it.
#[cfg(windows)]
fn msi_entries() -> Vec<String> {
  use std::os::windows::process::CommandExt;
  const CREATE_NO_WINDOW: u32 = 0x0800_0000;
  let reg = |args: &[&str]| {
    Command::new("reg")
      .args(args)
      .creation_flags(CREATE_NO_WINDOW)
      .output()
      .map(|out| String::from_utf8_lossy(&out.stdout).into_owned())
      .unwrap_or_default()
  };
  let mut entries = Vec::new();
  for root in [
    r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
    r"HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
  ] {
    let found = reg(&["query", root, "/s", "/f", "Marvel Champions", "/d", "/e"]);
    for key in found.lines().filter(|line| line.starts_with("HKEY_")) {
      entries.push(reg(&["query", key.trim()]));
    }
  }
  entries
}

#[cfg(not(windows))]
fn msi_entries() -> Vec<String> {
  Vec::new()
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
fn can_replace(game: &Path, kind: &str) -> bool {
  if cfg!(windows) {
    return true;
  }
  // A system package goes where the package manager puts it, as root, through polkit's password prompt. Only when the
  // package manager's own records say this game came from our package: a Debian or Fedora system alone says nothing
  // about how this copy got here (unpacked to /opt, built by hand), and the update must not install a package the
  // player never had.
  if kind == "deb" || kind == "rpm" {
    return has_pkexec() && owning_package(game, kind).is_some_and(|name| name == PACKAGE_NAME);
  }
  let Some(parent) = game.parent() else {
    return false;
  };
  let probe = parent.join(format!(".mc-update-probe-{}", std::process::id()));
  let made = std::fs::File::create(&probe).is_ok();
  let _ = std::fs::remove_file(&probe);
  made && (!kind.starts_with("dmg") || can_swap_in(parent))
}

/// Whether `dir`'s disk can swap two paths in one step, which the .app update needs so a crash can't leave the game
/// missing (update-game.sh). APFS can; HFS+ and exFAT can't, and an app there keeps the download link.
#[cfg(target_os = "macos")]
fn can_swap_in(dir: &Path) -> bool {
  use std::ffi::CString;
  use std::os::unix::ffi::OsStrExt;
  extern "C" {
    fn renamex_np(from: *const std::ffi::c_char, to: *const std::ffi::c_char, flags: u32) -> std::ffi::c_int;
  }
  const RENAME_SWAP: u32 = 0x2;
  let a = dir.join(format!(".mc-swap-probe-{}.a", std::process::id()));
  let b = dir.join(format!(".mc-swap-probe-{}.b", std::process::id()));
  // Each folder holds a file naming it, so a swap that reports success but only renames one over the other (a macFUSE
  // volume has been seen to) is caught: both folders must still be there, each holding the other's file.
  let swap = || -> bool {
    let made = std::fs::create_dir(&a).is_ok()
      && std::fs::create_dir(&b).is_ok()
      && std::fs::write(a.join("a"), b"a").is_ok()
      && std::fs::write(b.join("b"), b"b").is_ok();
    let (true, Ok(from), Ok(to)) = (made, CString::new(a.as_os_str().as_bytes()), CString::new(b.as_os_str().as_bytes()))
    else {
      return false;
    };
    // SAFETY: both are NUL-terminated paths that live through the call.
    let ok = unsafe { renamex_np(from.as_ptr(), to.as_ptr(), RENAME_SWAP) == 0 };
    ok && a.join("b").is_file() && b.join("a").is_file() && !a.join("a").exists() && !b.join("b").exists()
  };
  let swapped = swap();
  let _ = std::fs::remove_dir_all(&a);
  let _ = std::fs::remove_dir_all(&b);
  swapped
}

#[cfg(not(target_os = "macos"))]
fn can_swap_in(_dir: &Path) -> bool {
  false
}

/// The .deb's and .rpm's package name, from the app's product name (tauri.conf.json); update-game.sh checks the same.
const PACKAGE_NAME: &str = "marvel-champions";

/// The installed package that owns `game`, by the package manager's records (`dpkg-query -S`, `rpm -qf`).
fn owning_package(game: &Path, kind: &str) -> Option<String> {
  let output = if kind == "deb" {
    Command::new("dpkg-query").arg("-S").arg(game).output()
  } else {
    Command::new("rpm").args(["-qf", "--queryformat", "%{NAME}\n"]).arg(game).output()
  }
  .ok()?;
  if !output.status.success() {
    return None;
  }
  package_of(&String::from_utf8_lossy(&output.stdout), kind)
}

/// The package name in `dpkg-query -S` ("name: /path", or "name:arch: /path") or `rpm -qf` ("name") output.
fn package_of(output: &str, kind: &str) -> Option<String> {
  let line = output.lines().next()?.trim();
  let name = if kind == "deb" { line.split(':').next()? } else { line };
  (!name.is_empty() && !name.contains(char::is_whitespace)).then(|| name.to_owned())
}

fn has_pkexec() -> bool {
  std::env::var_os("PATH")
    .is_some_and(|path| std::env::split_paths(&path).any(|dir| dir.join("pkexec").is_file()))
}

/// The update this install can make itself, or `None`: run from a folder it
/// can't write to, a .deb or .rpm with no `pkexec` to ask for the password, or
/// a build no installer made (dev).
#[tauri::command]
pub fn self_update_info() -> Option<SelfUpdate> {
  let kind = crate::detect_installer_kind();
  installer_suffix(kind)?;
  if cfg!(debug_assertions) {
    return None;
  }
  let game = game_path()?;
  can_replace(&game, kind).then_some(SelfUpdate { kind })
}

#[cfg(windows)]
fn helper_command(helper: &Path, url: &str, kind: &str, version: &str, sha256: &str, game: &Path) -> Command {
  use std::os::windows::process::CommandExt;
  const CREATE_NO_WINDOW: u32 = 0x0800_0000;
  let mut command = Command::new("powershell.exe");
  command
    .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File"])
    .arg(helper)
    .args(["-Url", url, "-Kind", kind, "-Version", version, "-Sha256", sha256, "-Game"])
    .arg(game)
    .arg("-WaitPid")
    .arg(std::process::id().to_string())
    .creation_flags(CREATE_NO_WINDOW);
  command
}

#[cfg(not(windows))]
fn helper_command(helper: &Path, url: &str, kind: &str, version: &str, sha256: &str, game: &Path) -> Command {
  use std::os::unix::process::CommandExt;
  let mut command = Command::new("bash");
  let kind = if kind.starts_with("dmg") { "dmg" } else { kind };
  command
    .arg(helper)
    .args([url, kind, version])
    .arg(game)
    .arg(std::process::id().to_string())
    .arg(sha256)
    .process_group(0);
  // What the AppImage set up for the game would load the wrong libraries into the helper's curl.
  for name in ["LD_LIBRARY_PATH", "LD_PRELOAD", "PYTHONHOME", "PYTHONPATH", "PERLLIB", "PERL5LIB"] {
    command.env_remove(name);
  }
  command
}

/// Starts the update to `version` from `url`, this install's installer in that
/// release, whose SHA-256 the release lists as `digest`; or carries on with the
/// one already running. A download that doesn't match `digest` is never run.
#[tauri::command]
pub fn self_update_start(app: AppHandle, url: String, version: String, digest: String) -> Result<(), String> {
  let kind = self_update_info().ok_or("this install can't update itself")?.kind;
  if !is_installer_url(&url, kind) {
    return Err(format!("not this install's installer: {url}"));
  }
  if !is_version(&version) {
    return Err(format!("not a version: {version}"));
  }
  let sha256 = sha256_of(&digest).ok_or("the release doesn't list a checksum for this installer")?.to_owned();
  let game = game_path().ok_or("couldn't find the game")?;
  let dir = state_dir(&app)?;
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let helper = dir.join(HELPER_FILE);
  std::fs::write(&helper, HELPER).map_err(|e| e.to_string())?;
  spawn_update(&dir, || helper_command(&helper, &url, kind, &version, &sha256, &game))
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
    assert!(is_installer_url(&format!("{BASE}MarvelChampions-1.2.3-EN-Linux-x64.deb"), "deb"));
    // Another kind's installer, an unknown kind, another repo, a path that climbs, or anything a shell would read.
    assert!(!is_installer_url(&format!("{BASE}MarvelChampions-1.2.3-EN-Windows-x64-AllUsers.msi"), "nsis"));
    assert!(!is_installer_url(&format!("{BASE}MarvelChampions-1.2.3-EN-Linux-x64.deb"), "rpm"));
    assert!(!is_installer_url(&format!("{BASE}MarvelChampions-1.2.3-EN-Android.apk"), "apk"));
    assert!(!is_installer_url(
      "https://github.com/someone/else/releases/download/v1/MarvelChampions-1-EN-Linux-x64.AppImage",
      "appimage"
    ));
    assert!(!is_installer_url(&format!("{BASE}../x/MarvelChampions-1.2.3-EN-Linux-x64.AppImage"), "appimage"));
    assert!(!is_installer_url(&format!("{BASE}MarvelChampions-$(x)-EN-Linux-x64.AppImage"), "appimage"));
  }

  #[test]
  fn a_checksum_is_githubs_sha256_digest() {
    let hex = "73f3fd8aa378f534052f96dbd005318f285c3d4174a50fb84ded22c67ea80f49";
    assert_eq!(sha256_of(&format!("sha256:{hex}")), Some(hex));
    assert_eq!(sha256_of(hex), Some(hex));
    assert_eq!(sha256_of("sha256:abc"), None);
    assert_eq!(sha256_of(&format!("sha1:{hex}")), None);
    assert_eq!(sha256_of(&format!("sha256:{}; rm", &hex[..60])), None);
  }

  #[test]
  fn the_msi_is_told_by_its_windows_installer_entry_and_folder() {
    // As `reg query` printed the .msi's entry for a game installed to G:\MarvelChampions.
    let entry = r"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{E89A58A2}
    DisplayVersion    REG_SZ    0.49.0
    InstallLocation    REG_SZ    G:\MarvelChampions\
    WindowsInstaller    REG_DWORD    0x1
    DisplayName    REG_SZ    Marvel Champions
";
    let at = msi_install_location(entry).unwrap();
    assert_eq!(at, r"G:\MarvelChampions\");
    assert!(same_folder(Path::new(&at), Path::new(r"g:\marvelchampions")));
    assert!(!same_folder(Path::new(&at), Path::new(r"G:\Other")));
    // Not a Windows Installer entry, or one with no folder.
    assert!(msi_install_location(&entry.replace("0x1", "0x0")).is_none());
    assert!(msi_install_location("    WindowsInstaller    REG_DWORD    0x1\n").is_none());
  }

  #[test]
  fn the_package_that_owns_the_game_is_read_from_the_package_manager() {
    assert_eq!(package_of("marvel-champions: /usr/bin/marvel-champions\n", "deb").as_deref(), Some("marvel-champions"));
    assert_eq!(package_of("marvel-champions:amd64: /usr/bin/marvel-champions\n", "deb").as_deref(), Some("marvel-champions"));
    assert_eq!(package_of("marvel-champions\n", "rpm").as_deref(), Some("marvel-champions"));
    // rpm's answer for a file no package owns, and nothing at all.
    assert_eq!(package_of("file /opt/mc/marvel-champions is not owned by any package\n", "rpm"), None);
    assert_eq!(package_of("", "deb"), None);
  }

  #[test]
  fn a_version_is_three_numbers() {
    assert!(is_version("0.50.0"));
    assert!(!is_version("0.50"));
    assert!(!is_version("0.50.0; rm"));
    assert!(!is_version("v0.50.0"));
  }
}
