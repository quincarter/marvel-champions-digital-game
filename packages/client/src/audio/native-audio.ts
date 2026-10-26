/**
 * The Linux app's native audio (the Steam Deck, Bazzite and other desktops).
 *
 * WebKitGTK plays Web Audio through GStreamer, and on the Deck that crackled, popped and sounded robotic whatever the
 * context's rate, latency hint, PulseAudio buffer or bundled media framework (the owner, 2026-10-24). So on the Linux
 * desktop app the page hands each mp3's bytes to the shell (`src-tauri/src/native_audio.rs`), which decodes them and
 * plays them through the PulseAudio server (PipeWire's, on the Deck) in deep buffers. `NativeSound` is the little slice
 * of Phaser's sound API the music controller uses, so the controller plays either kind the same way.
 *
 * Every other platform (Windows, macOS, Android, the browser) keeps Phaser's Web Audio: `nativeAudioFor` is null there.
 */
import { isLinuxDesktopApp } from "../platform/linux-audio.js";

/** The event a sound answers `once` for when it plays to its end (Phaser's `Sound.Events.COMPLETE`). */
export const NATIVE_COMPLETE = "complete";

/** The longest the page waits between two volume messages for one sound; a fade is a stream of small steps. */
const VOLUME_SEND_GAP_MS = 40;

/** The shell's side, narrowed to what the page calls. */
export interface NativeAudioBridge {
  available(): Promise<boolean>;
  /** Hands over a file's bytes; answers its length in seconds. */
  load(key: string, bytes: ArrayBuffer): Promise<number>;
  play(id: number, key: string, volume: number, looped: boolean, music: boolean): Promise<void>;
  setVolume(id: number, volume: number): Promise<void>;
  setPaused(id: number, paused: boolean): Promise<void>;
  stop(id: number): Promise<void>;
  /** Calls `listener` with the id of each sound that plays to its end; returns the way to stop. */
  onEnded(listener: (id: number) => void): Promise<() => void>;
}

/** The real bridge: Tauri commands and events. */
export function tauriBridge(): NativeAudioBridge {
  const core = () => import("@tauri-apps/api/core");
  return {
    available: async () => (await core()).invoke<boolean>("native_audio_available"),
    load: async (key, bytes) =>
      (await core()).invoke<number>("native_audio_load", bytes, { headers: { "x-key": key } }),
    play: async (id, key, volume, looped, music) =>
      (await core()).invoke("native_audio_play", { id, key, volume, looped, music }),
    setVolume: async (id, volume) => (await core()).invoke("native_audio_set_volume", { id, volume }),
    setPaused: async (id, paused) => (await core()).invoke("native_audio_set_paused", { id, paused }),
    stop: async (id) => (await core()).invoke("native_audio_stop", { id }),
    onEnded: async (listener) =>
      (await import("@tauri-apps/api/event")).listen<number>("native-audio-ended", ({ payload }) => listener(payload)),
  };
}

/** What `NativeSound` is made with. */
export interface NativeSoundConfig {
  readonly loop?: boolean;
  readonly volume?: number;
  /** Music takes a deeper buffer than an effect; a looped sound is music. */
  readonly music?: boolean;
}

/** One playing (or paused, or finished) sound: the subset of Phaser's `BaseSound` the music controller uses. */
export class NativeSound {
  readonly #host: NativeAudio;
  readonly #id: number;
  readonly #key: string;
  readonly #loop: boolean;
  readonly #music: boolean;
  readonly duration: number;
  #volume: number;
  #playing = false;
  #paused = false;
  #destroyed = false;
  /** Seconds played before the current stretch (a pause banks it). */
  #banked = 0;
  #startedAt = 0;
  /** The shell's messages for this sound go out in the order they were made. */
  #chain: Promise<unknown> = Promise.resolve();
  #sentVolume = Number.NaN;
  #volumeTimer: ReturnType<typeof setTimeout> | null = null;
  #volumeDirty = false;
  readonly #completeListeners: (() => void)[] = [];

  constructor(host: NativeAudio, id: number, key: string, duration: number, config: NativeSoundConfig) {
    this.#host = host;
    this.#id = id;
    this.#key = key;
    this.duration = duration;
    this.#loop = config.loop ?? false;
    this.#music = config.music ?? this.#loop;
    this.#volume = config.volume ?? 1;
  }

  /** False while paused, as Phaser's own sounds report it, so `music-controller.ts` branches the same on every build. */
  get isPlaying(): boolean {
    return this.#playing && !this.#paused;
  }

  get isPaused(): boolean {
    return this.#paused;
  }

  get volume(): number {
    return this.#volume;
  }

  set volume(value: number) {
    this.#volume = value;
    this.#pushVolume();
  }

  /** Seconds into the sound (wrapping for a loop). */
  get seek(): number {
    const elapsed = this.#banked + (this.#playing && !this.#paused ? (performance.now() - this.#startedAt) / 1000 : 0);
    if (this.duration <= 0) return elapsed;
    return this.#loop ? elapsed % this.duration : Math.min(elapsed, this.duration);
  }

  /** The id the shell knows this sound by. */
  get id(): number {
    return this.#id;
  }

  play(): boolean {
    if (this.#destroyed || this.#playing) return false;
    this.#playing = true;
    this.#paused = false;
    this.#banked = 0;
    this.#startedAt = performance.now();
    const volume = this.#host.effectiveVolume(this.#volume);
    this.#sentVolume = volume;
    this.#send((bridge) => bridge.play(this.#id, this.#key, volume, this.#loop, this.#music));
    this.#host.register(this);
    return true;
  }

  pause(): boolean {
    if (!this.#playing || this.#paused) return false;
    this.#banked += (performance.now() - this.#startedAt) / 1000;
    this.#paused = true;
    this.#send((bridge) => bridge.setPaused(this.#id, true));
    return true;
  }

  resume(): boolean {
    if (!this.#playing || !this.#paused) return false;
    this.#paused = false;
    this.#startedAt = performance.now();
    this.#send((bridge) => bridge.setPaused(this.#id, false));
    return true;
  }

  stop(): boolean {
    if (!this.#playing) return false;
    this.#playing = false;
    this.#paused = false;
    this.#send((bridge) => bridge.stop(this.#id));
    this.#host.unregister(this);
    return true;
  }

  once(event: string, listener: () => void): this {
    if (event === NATIVE_COMPLETE) this.#completeListeners.push(listener);
    return this;
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.stop();
    this.#destroyed = true;
    this.#completeListeners.length = 0;
    if (this.#volumeTimer !== null) clearTimeout(this.#volumeTimer);
    this.#volumeTimer = null;
  }

  /** The shell says this sound played to its end. */
  ended(): void {
    if (!this.#playing) return;
    this.#playing = false;
    this.#paused = false;
    this.#host.unregister(this);
    const listeners = this.#completeListeners.splice(0);
    for (const listener of listeners) listener();
  }

  /** The master mute or the volume changed: the shell is told the new level. */
  refreshVolume(): void {
    this.#pushVolume();
  }

  #pushVolume(): void {
    if (!this.#playing) return;
    this.#volumeDirty = true;
    if (this.#volumeTimer !== null) return;
    const flush = (): void => {
      this.#volumeTimer = null;
      if (!this.#volumeDirty || !this.#playing) return;
      this.#volumeDirty = false;
      const level = this.#host.effectiveVolume(this.#volume);
      if (level !== this.#sentVolume) {
        this.#sentVolume = level;
        this.#send((bridge) => bridge.setVolume(this.#id, level));
        // Another step may follow in a fade: the next message waits its turn.
        this.#volumeTimer = setTimeout(flush, VOLUME_SEND_GAP_MS);
      }
    };
    flush();
  }

  #send(call: (bridge: NativeAudioBridge) => Promise<unknown>): void {
    this.#chain = this.#chain
      .then(() => call(this.#host.bridge))
      .catch((error: unknown) => console.warn("native audio:", error));
  }
}

/** The page's side of native playback: loads files into the shell and makes the sounds that play them. */
export class NativeAudio {
  readonly bridge: NativeAudioBridge;
  readonly #durations = new Map<string, number>();
  readonly #loading = new Map<string, Promise<void>>();
  readonly #playing = new Map<number, NativeSound>();
  #nextId = 1;
  #muted = false;
  #stopListening: (() => void) | null = null;

  constructor(bridge: NativeAudioBridge) {
    this.bridge = bridge;
    void bridge
      .onEnded((id) => this.#playing.get(id)?.ended())
      .then((stop) => {
        this.#stopListening = stop;
      })
      .catch((error: unknown) => console.warn("native audio:", error));
  }

  /** Whether `key`'s file is in the shell, ready to play. */
  has(key: string): boolean {
    return this.#durations.has(key);
  }

  /** Fetches `url` and hands its bytes to the shell. Rejects when the shell cannot take it (the caller falls back). */
  load(key: string, url: string): Promise<void> {
    if (this.has(key)) return Promise.resolve();
    const pending =
      this.#loading.get(key) ??
      (async () => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${url}: ${response.status}`);
        this.#durations.set(key, await this.bridge.load(key, await response.arrayBuffer()));
      })().finally(() => this.#loading.delete(key));
    this.#loading.set(key, pending);
    return pending;
  }

  add(key: string, config: NativeSoundConfig = {}): NativeSound {
    return new NativeSound(this, this.#nextId++, key, this.#durations.get(key) ?? 0, config);
  }

  /** The master mute (the Sound setting): every sound goes silent, and new ones start silent. */
  set muted(value: boolean) {
    if (value === this.#muted) return;
    this.#muted = value;
    for (const sound of this.#playing.values()) sound.refreshVolume();
  }

  effectiveVolume(volume: number): number {
    return this.#muted ? 0 : Math.max(0, volume);
  }

  register(sound: NativeSound): void {
    this.#playing.set(sound.id, sound);
  }

  unregister(sound: NativeSound): void {
    this.#playing.delete(sound.id);
  }

  dispose(): void {
    this.#stopListening?.();
  }
}

/**
 * The native audio for this platform, or null to leave the sound to Phaser: only the Linux desktop app has it, and
 * only when the shell can reach the audio server (else Phaser's Web Audio plays, as before).
 */
export async function nativeAudioFor(
  isTauri: boolean,
  userAgent: string,
  bridge: NativeAudioBridge = tauriBridge(),
): Promise<NativeAudio | null> {
  if (!isLinuxDesktopApp(isTauri, userAgent)) return null;
  try {
    return (await bridge.available()) ? new NativeAudio(bridge) : null;
  } catch (error) {
    console.warn("native audio unavailable:", error);
    return null;
  }
}

let current: NativeAudio | null = null;
let pending: Promise<NativeAudio | null> | null = null;
/** The Sound setting as last synced, kept so an instance that is published after the sync still starts muted. */
let wantMuted = false;

/** The Sound setting changed (or was first read): applies it now, or to the instance once the probe publishes it. */
export function setNativeMuted(muted: boolean): void {
  wantMuted = muted;
  if (current) current.muted = muted;
}

/**
 * Starts finding out whether this run plays natively (called once, from `main.ts`). Until it settles, the music
 * controller waits (`nativeAudioPending`) rather than loading a file the wrong way.
 */
export function startNativeAudio(
  isTauri: boolean,
  userAgent: string,
  bridge?: NativeAudioBridge,
): Promise<NativeAudio | null> {
  if (!isLinuxDesktopApp(isTauri, userAgent)) return Promise.resolve(null);
  pending = nativeAudioFor(isTauri, userAgent, bridge).then((audio) => {
    // Before it is published, and so before any waiting load resumes: the saved Sound setting may have synced already.
    if (audio) audio.muted = wantMuted;
    current = audio;
    pending = null;
    return audio;
  });
  return pending;
}

/** The native audio in use, or null (every platform but the Linux app, or the shell could not reach the server). */
export function nativeAudio(): NativeAudio | null {
  return current;
}

/** Non-null only while `startNativeAudio` is still finding out; settles when it knows. */
export function nativeAudioPending(): Promise<NativeAudio | null> | null {
  return pending;
}
