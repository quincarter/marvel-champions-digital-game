/**
 * The desktop app's audio context on Linux (the Steam Deck, Bazzite and other desktops).
 *
 * WebKitGTK plays Web Audio through GStreamer into PipeWire, which runs at 48 kHz. Left to itself the context ran at
 * the music's own 44.1 kHz and was resampled on the way out, in small buffers: the owner heard crackling, popping and
 * a robotic edge on the Deck (2026-10-24). A context made at 48 kHz decodes each file to the device's rate once, up
 * front, and `latencyHint: "playback"` asks for the larger output buffers a card game can afford (the shell also
 * lengthens PulseAudio's, `src-tauri/src/main.rs`). Everywhere else the browser's own default stays.
 */

/** The rate PipeWire (and PulseAudio's usual default) runs at. */
export const LINUX_AUDIO_RATE = 48_000;

/** True for the desktop app on Linux: a Tauri shell whose user agent names Linux and not Android. */
export function isLinuxDesktopApp(isTauri: boolean, userAgent: string): boolean {
  return isTauri && /Linux/i.test(userAgent) && !/Android/i.test(userAgent);
}

/** The audio context Phaser should use, or null to let it make its own. */
export function linuxAudioContext(isTauri: boolean, userAgent: string): AudioContext | null {
  if (!isLinuxDesktopApp(isTauri, userAgent) || typeof AudioContext === "undefined") return null;
  try {
    return new AudioContext({ sampleRate: LINUX_AUDIO_RATE, latencyHint: "playback" });
  } catch {
    return null;
  }
}
