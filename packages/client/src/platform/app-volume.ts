/**
 * The game's own volume in the Windows volume mixer (#243), in the Windows desktop app: the music player's slider and
 * Settings' Music volume row read and set it (`src-tauri/src/app_volume.rs`), so the game and the mixer always agree.
 * It is the game's entry in the mixer, never the computer's master volume.
 *
 * Everywhere else (a browser, the macOS and Linux apps) there is no such mixer to follow, and the slider is the game's
 * own music volume (`Settings.musicVolume`).
 */
import { MUSIC_VOLUME_MAX, clampMusicVolume } from "../settings.js";
import { detectPlatform } from "./platform.js";

/** True in the Windows desktop app, where the slider is the game's mixer volume. */
export function followsWindowsMixer(
  platform = detectPlatform(),
  userAgent: string = globalThis.navigator?.userAgent ?? "",
): boolean {
  return platform === "tauri" && /Windows/i.test(userAgent);
}

let known: number | null = null;

/** The mixer volume as last read or set, in percent; null before the first read, or when there is none to follow. */
export function knownMixerVolume(): number | null {
  return followsWindowsMixer() ? known : null;
}

/**
 * Reads the game's mixer volume, in percent. Null when there is none to follow: not the Windows app, or the game has
 * made no sound yet (Windows makes the game's mixer entry with its first sound).
 */
export async function readMixerVolume(): Promise<number | null> {
  if (!followsWindowsMixer()) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const level = await invoke<number | null>("app_volume");
    known = level === null ? null : clampMusicVolume(level * MUSIC_VOLUME_MAX);
  } catch (error) {
    console.warn("mixer volume:", error);
  }
  return known;
}

export interface MixerChange {
  /** The game's mixer volume in percent; null before its first sound. */
  readonly volume: number | null;
  /** Whether the computer's master volume is muted; null when unknown. */
  readonly muted: boolean | null;
}

const changeListeners = new Set<(change: MixerChange) => void>();
let listening = false;
let lastMuted: boolean | null = null;

/** Whether the computer's master volume was muted, as last heard. */
export function knownMasterMuted(): boolean | null {
  return lastMuted;
}

/**
 * Calls `listener` whenever the game's mixer volume or the master mute changes outside the game. The shell watches both
 * on a thread of its own while the watcher runs (`startMixerWatch`) and sends an `app-volume` event only on a change
 * (`src-tauri/src/app_volume.rs`), so the page does no polling. Nothing happens off the Windows app. Returns the way to stop.
 */
export function onMixerChange(listener: (change: MixerChange) => void): () => void {
  changeListeners.add(listener);
  if (followsWindowsMixer() && !listening) {
    listening = true;
    void import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen<{ volume: number | null; muted: boolean | null }>("app-volume", ({ payload }) => {
          known = payload.volume === null ? null : clampMusicVolume(payload.volume * MUSIC_VOLUME_MAX);
          lastMuted = payload.muted;
          for (const each of [...changeListeners]) each({ volume: known, muted: lastMuted });
        }),
      )
      .catch((error: unknown) => console.warn("mixer volume:", error));
  }
  return () => changeListeners.delete(listener);
}

let watching = false;

async function shell(command: string): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke(command);
  } catch (error) {
    console.warn("mixer volume:", error);
  }
}

/**
 * Starts the shell's watcher (`start_app_volume_watch`): while the music plays, or waits on a master mute. Its first
 * event carries the mixer's volume as it is now, so a play picks it up. Nothing off the Windows app.
 */
export function startMixerWatch(): void {
  if (!followsWindowsMixer() || watching) return;
  watching = true;
  void shell("start_app_volume_watch");
}

/** Stops the shell's watcher, while the player has the music paused: nothing is left running. */
export function stopMixerWatch(): void {
  if (!watching) return;
  watching = false;
  void shell("stop_app_volume_watch");
}

let writing: Promise<void> | null = null;
let queued: number | null = null;

/**
 * Sets the game's mixer volume, in percent. A drag sends many: while one is on its way only the latest waits behind
 * it, so the mixer ends where the slider stopped without a backlog.
 */
export function writeMixerVolume(percent: number): void {
  if (!followsWindowsMixer()) return;
  known = clampMusicVolume(percent);
  queued = known;
  if (writing) return;
  const send = async (): Promise<void> => {
    while (queued !== null) {
      const level = queued / MUSIC_VOLUME_MAX;
      queued = null;
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("set_app_volume", { level });
      } catch (error) {
        console.warn("mixer volume:", error);
      }
    }
    writing = null;
  };
  writing = send();
}
