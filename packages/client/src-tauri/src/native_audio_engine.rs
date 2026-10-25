//! The Linux app's own audio engine: decodes the game's mp3 music and sound effects and hands the samples to the
//! system's PulseAudio server (PipeWire's, on the Steam Deck and Bazzite) instead of letting WebKitGTK play them.
//!
//! Why: WebKitGTK plays Web Audio through GStreamer, whose small output buffers and resampling crackled, popped and
//! sounded robotic on the Deck even with a 48 kHz context, a longer PulseAudio buffer and the media framework bundled
//! (the owner, 2026-10-24). Here each sound is a "voice" on a thread of its own with its own PulseAudio stream, written
//! in big blocks into a deep server-side buffer; the server mixes the voices and resamples each to the device's rate.
//!
//! The decode and mixing logic is independent of PulseAudio (it writes to an [`Output`]), so it is unit-tested with a
//! recording output; `pulse_output` in `native_audio.rs` is the one Linux-only piece.

// Off Linux only the tests compile this file.
#![cfg_attr(not(target_os = "linux"), allow(dead_code))]

use std::collections::HashMap;
use std::io::Cursor;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::{Decoder, DecoderOptions};
use symphonia::core::errors::Error as SymError;
use symphonia::core::formats::{FormatOptions, FormatReader};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

/// Where a voice's samples go: one stream on the audio server.
pub trait Output {
  /// Writes interleaved 16-bit samples, blocking until the server's buffer has room (that is the voice's pacing).
  fn write(&mut self, samples: &[i16]) -> Result<(), String>;
  /// Waits for everything written to be heard.
  fn drain(&mut self);
  /// Drops everything written but not yet heard.
  fn flush(&mut self);
}

/// How a voice is heard: music sits behind a deeper buffer than an effect, which should land the moment it is played.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Kind {
  Music,
  Effect,
}

impl Kind {
  /// The server-side buffer the stream asks for, in milliseconds.
  pub fn latency_ms(self) -> u32 {
    match self {
      Kind::Music => 200,
      Kind::Effect => 80,
    }
  }
}

/// Opens an output stream for a voice: sample rate, channel count, kind.
pub type OutputFactory = Arc<dyn Fn(u32, u8, Kind) -> Result<Box<dyn Output>, String> + Send + Sync>;
/// Told when a voice has played to its end (not when it was stopped or looped).
pub type EndedCallback = Arc<dyn Fn(u32) + Send + Sync>;

struct Loaded {
  bytes: Arc<[u8]>,
}

/// What the page can change about a playing voice.
struct Control {
  /// The target gain, as f32 bits; the voice ramps to it across each block.
  volume: AtomicU32,
  paused: AtomicBool,
  stopped: AtomicBool,
}

pub struct Engine {
  factory: OutputFactory,
  ended: EndedCallback,
  sounds: Mutex<HashMap<String, Loaded>>,
  voices: Arc<Mutex<HashMap<u32, Arc<Control>>>>,
}

enum Flow {
  Continue,
  Stop,
}

/// Decodes `bytes` front to back, calling `block` with each run of interleaved samples, its rate and channel count.
fn decode_all(bytes: &Arc<[u8]>, mut block: impl FnMut(&[i16], u32, u8) -> Result<Flow, String>) -> Result<(), String> {
  let mss = MediaSourceStream::new(Box::new(Cursor::new(bytes.clone())), Default::default());
  let mut hint = Hint::new();
  hint.with_extension("mp3");
  let probed = symphonia::default::get_probe()
    .format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default())
    .map_err(|e| format!("probe: {e}"))?;
  let mut format: Box<dyn FormatReader> = probed.format;
  let track = format.default_track().ok_or("no audio track")?;
  let (id, params) = (track.id, track.codec_params.clone());
  let mut decoder: Box<dyn Decoder> = symphonia::default::get_codecs()
    .make(&params, &DecoderOptions::default())
    .map_err(|e| format!("codec: {e}"))?;
  let mut samples: Option<SampleBuffer<i16>> = None;
  loop {
    let packet = match format.next_packet() {
      Ok(packet) => packet,
      Err(SymError::IoError(e)) if e.kind() == std::io::ErrorKind::UnexpectedEof => return Ok(()),
      Err(SymError::ResetRequired) => return Ok(()),
      Err(e) => return Err(format!("read: {e}")),
    };
    if packet.track_id() != id {
      continue;
    }
    let decoded = match decoder.decode(&packet) {
      Ok(decoded) => decoded,
      // A damaged frame is skipped, as every player does.
      Err(SymError::DecodeError(_)) => continue,
      Err(e) => return Err(format!("decode: {e}")),
    };
    let spec = *decoded.spec();
    let needed = decoded.capacity() as u64;
    if samples.as_ref().is_none_or(|s| (s.capacity() as u64) < needed * spec.channels.count() as u64) {
      samples = Some(SampleBuffer::<i16>::new(needed, spec));
    }
    let buffer = samples.as_mut().expect("just made");
    buffer.copy_interleaved_ref(decoded);
    match block(buffer.samples(), spec.rate, spec.channels.count() as u8)? {
      Flow::Continue => {}
      Flow::Stop => return Ok(()),
    }
  }
}

/// `samples` with the gain ramped linearly from `from` to `to` across them (no click when the volume moves).
fn scale(samples: &[i16], from: f32, to: f32) -> Vec<i16> {
  let n = samples.len().max(1) as f32;
  samples
    .iter()
    .enumerate()
    .map(|(i, &s)| {
      let gain = from + (to - from) * (i as f32 / n);
      (s as f32 * gain).round().clamp(i16::MIN as f32, i16::MAX as f32) as i16
    })
    .collect()
}

impl Engine {
  pub fn new(factory: OutputFactory, ended: EndedCallback) -> Self {
    Engine { factory, ended, sounds: Mutex::new(HashMap::new()), voices: Arc::new(Mutex::new(HashMap::new())) }
  }

  /// Whether an output stream can be opened at all (the audio server is reachable).
  pub fn probe(&self) -> Result<(), String> {
    (self.factory)(48_000, 2, Kind::Effect).map(|_| ())
  }

  /// Keeps `bytes` (an mp3 file) under `key`; returns its length in seconds. Loading a key again replaces it.
  pub fn load(&self, key: &str, bytes: Vec<u8>) -> Result<f64, String> {
    let bytes: Arc<[u8]> = bytes.into();
    // Counting the decoded frames is the one length every mp3 gives (a header's own count is often missing).
    let (mut frames, mut rate) = (0u64, 0u32);
    decode_all(&bytes, |samples, r, channels| {
      frames += (samples.len() / channels.max(1) as usize) as u64;
      rate = r;
      Ok(Flow::Continue)
    })?;
    if rate == 0 {
      return Err("no audio in file".into());
    }
    self.sounds.lock().expect("sounds").insert(key.to_string(), Loaded { bytes });
    Ok(frames as f64 / rate as f64)
  }

  #[cfg(test)]
  pub fn is_loaded(&self, key: &str) -> bool {
    self.sounds.lock().expect("sounds").contains_key(key)
  }

  /// Starts voice `id` on the sound loaded under `key`.
  pub fn play(&self, id: u32, key: &str, volume: f32, looped: bool, kind: Kind) -> Result<(), String> {
    let bytes = {
      let sounds = self.sounds.lock().expect("sounds");
      sounds.get(key).ok_or_else(|| format!("sound {key} not loaded"))?.bytes.clone()
    };
    let control = Arc::new(Control {
      volume: AtomicU32::new(volume.to_bits()),
      paused: AtomicBool::new(false),
      stopped: AtomicBool::new(false),
    });
    if let Some(old) = self.voices.lock().expect("voices").insert(id, control.clone()) {
      old.stopped.store(true, Ordering::Relaxed);
    }
    let (factory, ended, voices) = (self.factory.clone(), self.ended.clone(), self.voices.clone());
    std::thread::Builder::new()
      .name(format!("audio-voice-{id}"))
      .spawn(move || {
        let natural = run_voice(&bytes, &control, looped, kind, &factory);
        let mut voices = voices.lock().expect("voices");
        // Only this voice's own entry: the id may have been played again meanwhile.
        if voices.get(&id).is_some_and(|c| Arc::ptr_eq(c, &control)) {
          voices.remove(&id);
        }
        drop(voices);
        if natural {
          ended(id);
        }
      })
      .map_err(|e| e.to_string())?;
    Ok(())
  }

  fn with_voice(&self, id: u32, f: impl FnOnce(&Control)) {
    if let Some(control) = self.voices.lock().expect("voices").get(&id) {
      f(control);
    }
  }

  pub fn set_volume(&self, id: u32, volume: f32) {
    self.with_voice(id, |c| c.volume.store(volume.to_bits(), Ordering::Relaxed));
  }

  pub fn set_paused(&self, id: u32, paused: bool) {
    self.with_voice(id, |c| c.paused.store(paused, Ordering::Relaxed));
  }

  pub fn stop(&self, id: u32) {
    if let Some(control) = self.voices.lock().expect("voices").remove(&id) {
      control.stopped.store(true, Ordering::Relaxed);
    }
  }

  /// Stops every voice, without an ended call for any. The engine outlives the page: a reload starts the page's ids
  /// over at 1, so the old page's voices would play on and their ended calls would land on the new page's sounds.
  pub fn stop_all(&self) {
    for (_, control) in self.voices.lock().expect("voices").drain() {
      control.stopped.store(true, Ordering::Relaxed);
    }
  }
}

/// Plays one voice to its end on the calling thread. True when it ended on its own (not stopped, not failed).
fn run_voice(bytes: &Arc<[u8]>, control: &Control, looped: bool, kind: Kind, factory: &OutputFactory) -> bool {
  let mut output: Option<Box<dyn Output>> = None;
  let mut gain = f32::from_bits(control.volume.load(Ordering::Relaxed));
  let result = loop {
    let mut frames = 0usize;
    let pass = decode_all(bytes, |samples, rate, channels| {
      while control.paused.load(Ordering::Relaxed) && !control.stopped.load(Ordering::Relaxed) {
        std::thread::sleep(Duration::from_millis(15));
      }
      if control.stopped.load(Ordering::Relaxed) {
        return Ok(Flow::Stop);
      }
      if output.is_none() {
        output = Some(factory(rate, channels, kind)?);
      }
      let target = f32::from_bits(control.volume.load(Ordering::Relaxed));
      let ramped = if gain == target && gain == 1.0 { None } else { Some(scale(samples, gain, target)) };
      gain = target;
      frames += samples.len() / channels.max(1) as usize;
      output.as_mut().expect("opened").write(ramped.as_deref().unwrap_or(samples))?;
      Ok(Flow::Continue)
    });
    // A file with nothing in it must not loop forever.
    if pass.is_ok() && looped && frames > 0 && !control.stopped.load(Ordering::Relaxed) {
      continue;
    }
    break pass;
  };
  let stopped = control.stopped.load(Ordering::Relaxed);
  if let Err(e) = &result {
    eprintln!("native audio: {e}");
  }
  if let Some(out) = output.as_mut() {
    if stopped || result.is_err() {
      out.flush();
    } else {
      out.drain();
    }
  }
  !stopped && result.is_ok()
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn scale_ramps_across_the_block() {
    assert_eq!(scale(&[1000, 1000, 1000, 1000], 1.0, 0.0), vec![1000, 750, 500, 250]);
  }

  #[test]
  fn scale_clamps() {
    assert_eq!(scale(&[30000], 2.0, 2.0), vec![i16::MAX]);
  }

  #[test]
  fn garbage_is_not_a_sound() {
    let engine = Engine::new(Arc::new(|_, _, _| Err("none".into())), Arc::new(|_| {}));
    assert!(engine.load("x", vec![1, 2, 3, 4, 5, 6, 7, 8]).is_err());
    assert!(!engine.is_loaded("x"));
    assert!(engine.play(1, "x", 1.0, false, Kind::Music).is_err());
  }

  /// A real mp3 from the game: loads with a length, plays through a recording output, ends on its own, can be looped
  /// and stopped.
  #[test]
  fn plays_a_real_effect() {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../src/audio/sfx/card-played.mp3");
    let bytes = std::fs::read(path).expect("sfx file");
    let written = Arc::new(Mutex::new(0usize));
    struct Rec(Arc<Mutex<usize>>);
    impl Output for Rec {
      fn write(&mut self, s: &[i16]) -> Result<(), String> {
        *self.0.lock().unwrap() += s.len();
        Ok(())
      }
      fn drain(&mut self) {}
      fn flush(&mut self) {}
    }
    let w = written.clone();
    let (tx, rx) = std::sync::mpsc::channel();
    let tx = Mutex::new(tx);
    let engine = Engine::new(
      Arc::new(move |_, _, _| Ok(Box::new(Rec(w.clone())) as Box<dyn Output>)),
      Arc::new(move |id| {
        let _ = tx.lock().unwrap().send(id);
      }),
    );
    let duration = engine.load("fx", bytes).expect("loads");
    assert!(duration > 0.05 && duration < 30.0, "duration {duration}");
    engine.play(7, "fx", 0.5, false, Kind::Effect).expect("plays");
    assert_eq!(rx.recv_timeout(Duration::from_secs(10)).expect("ended"), 7);
    assert!(*written.lock().unwrap() > 0);

    // Looped: never ends on its own; stop ends it without an ended call.
    engine.play(8, "fx", 1.0, true, Kind::Music).expect("plays");
    assert!(rx.recv_timeout(Duration::from_millis(600)).is_err());
    engine.stop(8);
    assert!(rx.recv_timeout(Duration::from_millis(600)).is_err());

    // A page reload: every voice stops, and none reports an end.
    engine.play(9, "fx", 1.0, true, Kind::Music).expect("plays");
    engine.play(10, "fx", 1.0, false, Kind::Effect).expect("plays");
    engine.stop_all();
    assert!(rx.recv_timeout(Duration::from_millis(600)).is_err());
    assert!(engine.voices.lock().unwrap().is_empty());
  }
}
