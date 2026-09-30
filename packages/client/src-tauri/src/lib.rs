// The context (and with it all of dist/, embedded) is generated in main.rs, not
// here: expanded in this lib crate, the embedded assets were also written into
// its crate metadata at ~4x their size, and the resulting .rlib passed 4 GB,
// which MSVC's link.exe can't read ("LNK4003: invalid library format").
pub fn run(context: tauri::Context<tauri::Wry>) {
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
    .run(context)
    .expect("error while running tauri application");
}
