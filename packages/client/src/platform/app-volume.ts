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
