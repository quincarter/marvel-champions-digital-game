/**
 * The opt-in for global win rates. Off until the player says yes: nothing is ever uploaded unless the state is "on".
 *
 * Kept in `localStorage` under keys that do NOT start with `mc-`, so device sync (which carries only `mc-` keys) leaves
 * them alone: each device consents for itself. Every read and write is in a try/catch (private mode, a full quota, no
 * storage at all reads as "unset", and a write that fails changes nothing).
 *
 * Turning it on snapshots the ids of the games already finished into the sent set, so only games finished from then on
 * are ever sent, which is what the prompt promises. The set holds this device's save ids and never leaves it.
 */
import type { SaveMeta } from "../engine/game-storage.js";

export const GLOBAL_CONSENT_KEY = "global-stats-consent";
export const GLOBAL_SENT_KEY = "global-stats-sent";
export const GLOBAL_SINCE_KEY = "global-stats-since";
/** How many sent ids are remembered; the oldest go first. */
export const SENT_CAP = 2000;

export type GlobalConsent = "unset" | "on" | "off";
export type ConsentStorage = Pick<Storage, "getItem" | "setItem">;

export function browserStorage(): ConsentStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readConsent(storage: ConsentStorage | null = browserStorage()): GlobalConsent {
  try {
    const raw = storage?.getItem(GLOBAL_CONSENT_KEY);
    return raw === "on" || raw === "off" ? raw : "unset";
  } catch {
    return "unset";
  }
}

/** Whether the player has answered the prompt (either way), for the ask-once rule. */
export const wasAsked = (storage: ConsentStorage | null = browserStorage()): boolean =>
  readConsent(storage) !== "unset";

/** Finished games that count as results: the ones the uploader could ever send. */
export const finishedIdsOf = (saves: readonly SaveMeta[]): string[] =>
  saves.filter((m) => !m.guided && (m.status === "won" || m.status === "lost")).map((m) => m.id);

export function readSent(storage: ConsentStorage | null = browserStorage()): Set<string> {
  try {
    const raw = storage?.getItem(GLOBAL_SENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

/** Writes the set, keeping the newest `SENT_CAP`; false when the write failed. */
function writeSent(storage: ConsentStorage | null, ids: Iterable<string>): boolean {
  try {
    if (!storage) return false;
    storage.setItem(GLOBAL_SENT_KEY, JSON.stringify([...ids].slice(-SENT_CAP)));
    return true;
  } catch {
    return false;
  }
}

export function markSent(ids: readonly string[], storage: ConsentStorage | null = browserStorage()): boolean {
  const sent = readSent(storage);
  for (const id of ids) {
    sent.delete(id);
    sent.add(id);
  }
  return writeSent(storage, sent);
}

/** When the player turned sharing on (ms), or null: a game last written before this is never sent. */
export function consentSince(storage: ConsentStorage | null = browserStorage()): number | null {
  try {
    const n = Number(storage?.getItem(GLOBAL_SINCE_KEY));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * Turns sharing on. `finishedIds` is every game finished so far (`finishedIdsOf(await store.listSaves())`); they go
 * into the sent set first, so none is ever sent. Returns false, and stays off, when the choice could not be saved.
 */
export function turnOnGlobalStats(
  finishedIds: readonly string[],
  storage: ConsentStorage | null = browserStorage(),
  now: number = Date.now(),
): boolean {
  if (!storage) return false;
  // The snapshot goes first: a failure part way leaves sharing off, never on with the old games unmarked.
  if (!markSent(finishedIds, storage)) return false;
  try {
    storage.setItem(GLOBAL_SINCE_KEY, String(now));
    storage.setItem(GLOBAL_CONSENT_KEY, "on");
    return true;
  } catch {
    return false;
  }
}

/** Turns sharing off (also how "No thanks" is remembered); nothing is sent from here on. */
export function turnOffGlobalStats(storage: ConsentStorage | null = browserStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(GLOBAL_CONSENT_KEY, "off");
    return true;
  } catch {
    return false;
  }
}
