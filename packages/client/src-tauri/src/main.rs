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
  marvel_champions_lib::run(tauri::generate_context!());
}
