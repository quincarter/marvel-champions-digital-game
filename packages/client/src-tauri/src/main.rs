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
  marvel_champions_lib::run(tauri::generate_context!());
}
