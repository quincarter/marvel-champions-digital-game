mod display_mode;

// The context (and with it all of dist/, embedded) is generated in main.rs, not
// here: expanded in this lib crate, the embedded assets were also written into
// its crate metadata at ~4x their size, and the resulting .rlib passed 4 GB,
// which MSVC's link.exe can't read ("LNK4003: invalid library format").

/// Which of a release's installers this install came from, for the update
/// notice's direct download (src/platform/update-check.ts): "nsis", "msi",
/// "dmg-aarch64", "dmg-x64", "appimage", "deb" or "rpm", or "" when it can't
/// tell, and the notice then links the release page only.
#[tauri::command]
fn installer_kind() -> &'static str {
  if cfg!(target_os = "windows") {
    // The .msi installs per machine under Program Files; the NSIS setup.exe
    // installs per user under AppData.
    let exe = std::env::current_exe().ok();
    let path = exe.as_deref().and_then(|p| p.to_str()).map(str::to_ascii_lowercase);
    match path {
      Some(p) if p.contains("\\program files") => "msi",
      Some(_) => "nsis",
      None => "",
    }
  } else if cfg!(target_os = "macos") {
    // The build's own architecture, so an Intel build under Rosetta keeps
    // getting the Intel .dmg it was installed from.
    if cfg!(target_arch = "aarch64") {
      "dmg-aarch64"
    } else {
      "dmg-x64"
    }
  } else if std::env::var_os("APPIMAGE").is_some() {
    "appimage"
  } else if std::path::Path::new("/etc/debian_version").exists() {
    "deb"
  } else if ["/etc/redhat-release", "/etc/fedora-release", "/etc/SuSE-release"]
    .iter()
    .any(|p| std::path::Path::new(p).exists())
  {
    "rpm"
  } else {
    ""
  }
}

pub fn run(context: tauri::Context<tauri::Wry>) {
  tauri::Builder::default()
    // Native HTTP for MarvelCDB deck import, which the page can't make
    // cross-origin; scoped in capabilities/default.json.
    .plugin(tauri_plugin_http::init())
    // Opens links (release notes, an update's download, MarvelCDB) in the
    // default browser: the webview ignores `window.open`. Also scoped in
    // capabilities/default.json.
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![
      installer_kind,
      display_mode::display_modes,
      display_mode::set_display_mode,
      display_mode::restore_display_mode,
      display_mode::linux_distro
    ])
    // Exclusive fullscreen gives the monitor back while the game is in the background (display_mode.rs).
    .on_window_event(|_, event| {
      if let tauri::WindowEvent::Focused(focused) = event {
        display_mode::on_focus(*focused);
      }
    })
    // No card-art code here on purpose: the scans are bundled into `dist/` at
    // build time (vite-card-art.ts) and load as ordinary same-origin files.
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .build(context)
    .expect("error while building tauri application")
    .run(|_, event| {
      // The user's own display mode back on the way out (Windows would also restore it once the process ends).
      if let tauri::RunEvent::Exit = event {
        display_mode::restore(false);
      }
    });
}
