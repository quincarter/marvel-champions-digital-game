/**
 * Add to Steam from the game (issue #844, `src-tauri/src/steam_add.rs`): runs the Install for Steam script this build
 * carries to add the running game to the player's Steam library, with its art. Offered only on the desktop app, where
 * Steam is installed and the game isn't in its library yet (nor started by Steam). It runs like the script's update, so
 * the same panel (`scenes/steam-update.ts`) and status call follow it.
 */

import { detectPlatform } from "./platform.js";
import { readSteamInstallAgain } from "./steam-install.js";

export interface SteamAdd {
  readonly canAdd: boolean;
}

let known: Promise<SteamAdd | null> | null = null;
let answer: SteamAdd | null = null;

async function invokeShell<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

/** Read once per launch, from Title. Never rejects: anything that goes wrong means nothing to offer. */
export function steamAdd(): Promise<SteamAdd | null> {
  if (known !== null) return known;
  if (detectPlatform() !== "tauri") return (known = Promise.resolve(null));
  known = invokeShell<SteamAdd | null>("steam_add_info")
    .catch(() => null)
    .then((info) => (answer = info));
  return known;
}

/** The answer if it has been read: for Settings, which is drawn after Title and can't wait on it. */
export const knownSteamAdd = (): SteamAdd | null => answer;

/**
 * Once the game is in Steam there is nothing more to offer this launch; and the script's install record now names this
 * game, so the Steam script's update takes over from here (`steam-install.ts`). Once per add, however often it's called.
 */
export function steamAddDone(): void {
  if (answer === null && known !== null) return;
  answer = null;
  known = Promise.resolve(null);
  void readSteamInstallAgain();
}

/** Starts adding the game to Steam in `language`'s cards, or carries on with the run already going. */
export function startSteamAdd(language: string): Promise<void> {
  return invokeShell("steam_add_start", { language });
}
