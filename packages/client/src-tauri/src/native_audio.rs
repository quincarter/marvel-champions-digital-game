//! The Linux app's native music and sound-effect playback (`src/audio/native-audio.ts` is the page's side).
//!
//! WebKitGTK's Web Audio crackled and sounded robotic on the Steam Deck however it was tuned (the owner, 2026-10-24),
//! so on Linux the page hands its mp3 bytes to `native_audio_engine.rs`, which decodes them and plays them through the
//! PulseAudio server (PipeWire's, on the Deck). Off Linux every command here answers "unsupported", and the page never
//! asks: Windows, macOS, Android and the browser keep playing through the webview.

#[cfg(target_os = "linux")]
mod imp {
  use crate::native_audio_engine::{Engine, EndedCallback, Kind, Output, OutputFactory};
  use libpulse_binding::def::BufferAttr;
  use libpulse_binding::sample::{Format, Spec};
  use libpulse_binding::stream::Direction;
  use libpulse_simple_binding::Simple;
  use std::sync::{Arc, OnceLock};
  use tauri::Emitter;

  struct PulseOutput(Simple);

  impl Output for PulseOutput {
    fn write(&mut self, samples: &[i16]) -> Result<(), String> {
      // S16NE: the samples' own bytes.
      let bytes = samples.iter().flat_map(|s| s.to_ne_bytes()).collect::<Vec<u8>>();
      self.0.write(&bytes).map_err(|e| format!("{e}"))
    }
    fn drain(&mut self) {
      let _ = self.0.drain();
    }
    fn flush(&mut self) {
      let _ = self.0.flush();
    }
  }

  fn pulse_factory() -> OutputFactory {
    Arc::new(|rate, channels, kind| {
      let spec = Spec { format: Format::S16NE, channels, rate };
      if !spec.is_valid() {
        return Err(format!("unusable audio format: {rate} Hz, {channels} channels"));
      }
      let bytes_per_ms = (rate as u64 * channels as u64 * 2) / 1000;
      // A deep server-side buffer is what keeps playback from crackling when a thread is late; everything else is the
      // server's default.
      let attr = BufferAttr {
        maxlength: u32::MAX,
        tlength: (bytes_per_ms * kind.latency_ms() as u64) as u32,
        prebuf: u32::MAX,
        minreq: u32::MAX,
        fragsize: u32::MAX,
      };
      let stream = if kind == Kind::Music { "Music" } else { "Sound effect" };
      Simple::new(None, "Marvel Champions", Direction::Playback, None, stream, &spec, None, Some(&attr))
        .map(|simple| Box::new(PulseOutput(simple)) as Box<dyn Output>)
        .map_err(|e| format!("{e}"))
    })
  }

  static ENGINE: OnceLock<Engine> = OnceLock::new();

  pub fn engine(app: &tauri::AppHandle) -> &'static Engine {
    ENGINE.get_or_init(|| {
      let app = app.clone();
      let ended: EndedCallback = Arc::new(move |id| {
        let _ = app.emit("native-audio-ended", id);
      });
      Engine::new(pulse_factory(), ended)
    })
  }
}

#[cfg(target_os = "linux")]
use crate::native_audio_engine::Kind;
#[cfg(target_os = "linux")]
use imp::engine;

#[cfg(not(target_os = "linux"))]
const UNSUPPORTED: &str = "native audio is Linux-only";

/// Whether the audio server can be reached. The page uses native playback only when this succeeds. The page asks once as
/// it starts, so this also stops whatever a page before a reload left playing.
#[tauri::command]
pub async fn native_audio_available(app: tauri::AppHandle) -> Result<bool, String> {
  #[cfg(target_os = "linux")]
  {
    let probe = tauri::async_runtime::spawn_blocking(move || {
      let engine = engine(&app);
      engine.stop_all();
      engine.probe()
    })
    .await
    .map_err(|e| e.to_string())?;
    if let Err(e) = &probe {
      eprintln!("native audio unavailable: {e}");
    }
    Ok(probe.is_ok())
  }
  #[cfg(not(target_os = "linux"))]
  {
    let _ = app;
    Ok(false)
  }
}

/// Keeps an mp3 (the request's raw body) under the `x-key` header; answers its length in seconds.
#[tauri::command]
pub async fn native_audio_load(app: tauri::AppHandle, request: tauri::ipc::Request<'_>) -> Result<f64, String> {
  #[cfg(target_os = "linux")]
  {
    let key = request
      .headers()
      .get("x-key")
      .and_then(|v| v.to_str().ok())
      .ok_or("missing x-key header")?
      .to_string();
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
      return Err("expected the file's bytes".into());
    };
    let bytes = bytes.clone();
    tauri::async_runtime::spawn_blocking(move || engine(&app).load(&key, bytes))
      .await
      .map_err(|e| e.to_string())?
  }
  #[cfg(not(target_os = "linux"))]
  {
    let _ = (app, request);
    Err(UNSUPPORTED.into())
  }
}

/// Starts voice `id` on the sound loaded under `key`. `music` picks the deeper buffer.
#[tauri::command]
pub fn native_audio_play(
  app: tauri::AppHandle,
  id: u32,
  key: String,
  volume: f32,
  looped: bool,
  music: bool,
) -> Result<(), String> {
  #[cfg(target_os = "linux")]
  {
    let kind = if music { Kind::Music } else { Kind::Effect };
    engine(&app).play(id, &key, volume, looped, kind)
  }
  #[cfg(not(target_os = "linux"))]
  {
    let _ = (app, id, key, volume, looped, music);
    Err(UNSUPPORTED.into())
  }
}

#[tauri::command]
pub fn native_audio_set_volume(app: tauri::AppHandle, id: u32, volume: f32) {
  #[cfg(target_os = "linux")]
  engine(&app).set_volume(id, volume);
  #[cfg(not(target_os = "linux"))]
  let _ = (app, id, volume);
}

#[tauri::command]
pub fn native_audio_set_paused(app: tauri::AppHandle, id: u32, paused: bool) {
  #[cfg(target_os = "linux")]
  engine(&app).set_paused(id, paused);
  #[cfg(not(target_os = "linux"))]
  let _ = (app, id, paused);
}

#[tauri::command]
pub fn native_audio_stop(app: tauri::AppHandle, id: u32) {
  #[cfg(target_os = "linux")]
  engine(&app).stop(id);
  #[cfg(not(target_os = "linux"))]
  let _ = (app, id);
}
