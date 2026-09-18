mod card_art;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // Native HTTP for MarvelCDB deck import, which the page can't make
    // cross-origin; scoped in capabilities/default.json.
    .plugin(tauri_plugin_http::init())
    // Card scans, fetched and disk-cached here rather than through the page;
    // see card_art.rs.
    .register_asynchronous_uri_scheme_protocol(card_art::SCHEME, |ctx, request, responder| {
      let response = card_art::handle(ctx.app_handle(), request);
      tauri::async_runtime::spawn(async move { responder.respond(response.await) });
    })
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
