// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  // Linux: the webview plays audio through GStreamer's PulseAudio sink (PipeWire's pulse server on the Steam Deck and
  // Bazzite). Its default buffer is short enough that the game's audio crackled and popped there (the owner,
  // 2026-10-24); a longer one costs a few tens of milliseconds of latency nobody hears in a card game. Set before the
  // webview starts, and only when the player hasn't chosen their own.
  #[cfg(target_os = "linux")]
  if std::env::var_os("PULSE_LATENCY_MSEC").is_none() {
    std::env::set_var("PULSE_LATENCY_MSEC", "90");
  }
  // Linux: WebKitGTK's DMA-BUF renderer left canvas-backed textures corrupt or blank on Bazzite and the Steam Deck
  // (blocky noise, white tiles; the owner, 2026-10-24). The usual Tauri-on-Linux workaround, set only when the player
  // hasn't chosen their own.
  #[cfg(target_os = "linux")]
  if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
  }
  // Linux AppImage: the bundle carries its own GTK accessibility bridge (libatk-bridge), older than the AT-SPI service
  // on a current distro. The pair disagree ("atk-bridge: get_device_events_reply: unknown signature", the only line the
  // app printed when the page froze for good on Bazzite with keys, pads and clicks all dead; the owner, 2026-10-25), and
  // the bridge handles every key event, so it is the likeliest cause. The game is one canvas with nothing for a screen
  // reader to read, so the bridge is off in the AppImage, unless the player set it themselves. The .deb and .rpm use the
  // distro's own matching libraries and keep it.
  #[cfg(target_os = "linux")]
  if std::env::var_os("APPIMAGE").is_some() && std::env::var_os("NO_AT_BRIDGE").is_none() {
    std::env::set_var("NO_AT_BRIDGE", "1");
  }
  marvel_champions_lib::run(tauri::generate_context!());
}
