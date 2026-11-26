/**
 * The host's room settings, kept on this device so the next room opens with them (GarethMagis, 2026-11-25: "a way to
 * save my host settings"). Every change the host makes in a lobby is remembered; a new lobby applies what was kept once,
 * as it opens. Only the table's settings travel: not a room's mods or house rules (they belong to the game being set
 * up), not its mode (Standard or Epic is picked on the way in), and never anything about who is in it.
 */
import type { LobbySettingsPatch } from "@mc/sync-worker/room-protocol";

export const HOST_SETTINGS_KEY = "mc-room-host-settings";

/** The settings a host's next room starts from, and the number of seats. */
export interface KeptHostSettings {
  readonly settings: LobbySettingsPatch;
  readonly seats?: number;
}

const KEPT_KEYS = [
  "playMode",
  "undo",
  "cheats",
  "multiSeat",
  "handover",
  "tieBreaks",
  "hostSeesHands",
  "openHands",
  "villainPacing",
  "askToSit",
  "chat",
  "listed",
] as const satisfies readonly (keyof LobbySettingsPatch)[];

/** The part of a settings change that is kept. */
export function keptPartOf(patch: LobbySettingsPatch): LobbySettingsPatch {
  const out: Record<string, unknown> = {};
  for (const key of KEPT_KEYS) if (patch[key] !== undefined) out[key] = patch[key];
  return out as LobbySettingsPatch;
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/** What this device keeps, or nothing kept (also for anything unreadable). */
export function readHostSettings(storage: Pick<Storage, "getItem"> | null = defaultStorage()): KeptHostSettings {
  try {
    const raw = storage?.getItem(HOST_SETTINGS_KEY);
    if (!raw) return { settings: {} };
    const parsed = JSON.parse(raw) as { settings?: unknown; seats?: unknown };
    const settings =
      typeof parsed.settings === "object" && parsed.settings !== null
        ? keptPartOf(parsed.settings as LobbySettingsPatch)
        : {};
    const seats =
      typeof parsed.seats === "number" && Number.isInteger(parsed.seats) && parsed.seats > 0 ? parsed.seats : undefined;
    return seats === undefined ? { settings } : { settings, seats };
  } catch {
    return { settings: {} };
  }
}

/** Folds a host's change into what is kept. Never throws: a device that cannot keep it just starts from the defaults. */
export function keepHostSettings(
  change: { readonly settings?: LobbySettingsPatch; readonly seats?: number },
  storage: Pick<Storage, "getItem" | "setItem"> | null = defaultStorage(),
): void {
  const kept = readHostSettings(storage);
  const next: KeptHostSettings = {
    settings: { ...kept.settings, ...keptPartOf(change.settings ?? {}) },
    ...((change.seats ?? kept.seats) !== undefined ? { seats: change.seats ?? kept.seats } : {}),
  };
  try {
    storage?.setItem(HOST_SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked.
  }
}

/** Whether anything is kept to apply to a new lobby. */
export const hasKeptSettings = (kept: KeptHostSettings): boolean => Object.keys(kept.settings).length > 0;
