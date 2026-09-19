#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // Native HTTP for MarvelCDB deck import, which the page can't make
    // cross-origin; scoped in capabilities/default.json.
    .plugin(tauri_plugin_http::init())
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
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
