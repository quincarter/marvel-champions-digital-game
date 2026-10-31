/**
 * The Install for Steam script's record of this install (`src-tauri/src/steam_install.rs`): whether the script put this
 * game here, and running the script's saved copy to update it. Only the desktop app has either.
 */

import { detectPlatform } from "./platform.js";
import type { SteamUpdateStatus } from "../view/steam-update.js";

export interface SteamInstall {
  /** False when the script's saved copy is gone, so there is nothing to run. */
  readonly canUpdate: boolean;
}

let known: Promise<SteamInstall | null> | null = null;
let answer: SteamInstall | null = null;

/** Read once per launch, from Title. Never rejects: anything that goes wrong means no record. */
export function steamInstall(): Promise<SteamInstall | null> {
  if (known !== null) return known;
  if (detectPlatform() !== "tauri") return (known = Promise.resolve(null));
  known = invokeShell<SteamInstall | null>("steam_install_info")
    .catch(() => null)
    .then((install) => (answer = install));
  return known;
}

/** The record if it has been read: for screens drawn after Title, which can't wait on it. */
export const knownSteamInstall = (): SteamInstall | null => answer;

async function invokeShell<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

/** Starts the script, or carries on with the one already running. */
export function startSteamUpdate(language: string): Promise<void> {
  return invokeShell("steam_update_start", { language });
}

export function steamUpdateStatus(): Promise<SteamUpdateStatus> {
  return invokeShell("steam_update_status");
}

/** Quits the game, which is what the waiting script needs to finish. */
export function quitForSteamUpdate(): Promise<void> {
  return invokeShell("steam_update_quit");
}
