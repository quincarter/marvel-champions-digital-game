/**
 * The game's own updater (issue #843, `src-tauri/src/self_update.rs`), for a desktop install from the release's
 * installers rather than the Install for Steam script: it downloads this install's installer in the new release, then
 * the game restarts to install it. It runs and reports like the Steam script's update (`steam-install.ts`), so the
 * same panel (`scenes/steam-update.ts`) and status call follow it.
 *
 * Only the desktop app has it, and not every install there: a .deb or .rpm is the system's package to replace, an app in
 * a folder the player can't write to can't replace itself, and the Android app's update is the system installer's.
 * Those keep the update banner's download link.
 */

import { detectPlatform } from "./platform.js";
import { steamUpdateStatus } from "./steam-install.js";
import { readyVersionOf, updateFailedAfterQuit } from "../view/steam-update.js";

export interface SelfUpdate {
  /** The installer it updates with (`update-check.ts`'s `InstallerKind`). */
  readonly kind: string;
}

let known: Promise<SelfUpdate | null> | null = null;

async function invokeShell<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

/** Whether this install can update itself. Asked once per launch; never rejects. */
export function selfUpdateInfo(): Promise<SelfUpdate | null> {
  if (known !== null) return known;
  if (detectPlatform() !== "tauri") return (known = Promise.resolve(null));
  known = invokeShell<SelfUpdate | null>("self_update_info").catch(() => null);
  return known;
}

/**
 * Starts downloading `url` (this install's installer in release `version`, whose checksum the release lists as
 * `digest`), or carries on with the one running. A download that doesn't match `digest` is never installed.
 */
export function startSelfUpdate(url: string, version: string, digest: string): Promise<void> {
  return invokeShell("self_update_start", { url, version, digest });
}

/**
 * The version a finished download is waiting to install, from either updater, or null. The Title asks on each visit,
 * so its "The game has been updated" banner shows once the panel is closed. Never rejects.
 */
export function readyUpdateVersion(): Promise<string | null> {
  if (detectPlatform() !== "tauri") return Promise.resolve(null);
  return steamUpdateStatus().then(readyVersionOf, () => null);
}

/** Whether the last update was installing when it failed, after the game quit for it. Never rejects. */
export function lastUpdateFailed(): Promise<boolean> {
  if (detectPlatform() !== "tauri") return Promise.resolve(false);
  return steamUpdateStatus().then(updateFailedAfterQuit, () => false);
}
