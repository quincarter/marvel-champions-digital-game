/**
 * The save-data file: one JSON document holding everything the client keeps on this device (docs/save-data.md).
 *
 * It is a snapshot of the stores as they are, not a translation of them: each IndexedDB database's records verbatim,
 * by store, plus the `mc-*` `localStorage` entries. That keeps export and import free of per-feature code, and it is
 * the shape a later cloud sync can upload and download unchanged. Two versions guard it:
 *
 *  - `version` is this envelope's own format. A build reads every version up to its own and refuses a newer one.
 *  - each database carries the schema version it was exported at. A build refuses a database newer than its own,
 *    since it can't know what changed; an older one restores as-is and the storage class's own migrations
 *    (`migrateSaveMeta` and friends) upgrade its records on read, as they would for data that never left the device.
 *
 * Nothing in here touches storage: `save-data.ts` does the reading and writing, so this stays pure and tested.
 */
import { SAVED_DATABASES, SAVED_LOCAL_STORAGE_PREFIX, type DatabaseSpec } from "./databases.js";

export const SAVE_FILE_FORMAT = "mc-save-data";
export const SAVE_FILE_VERSION = 1;

/** One database: its schema version at export, and every record of every store. */
export interface SavedDatabase {
  readonly version: number;
  readonly stores: Readonly<Record<string, readonly unknown[]>>;
}

export interface SaveFile {
  readonly format: typeof SAVE_FILE_FORMAT;
  readonly version: number;
  /** Milliseconds since the epoch. */
  readonly exportedAt: number;
  /** The client release that wrote the file, for a person reading it; nothing branches on it. */
  readonly appVersion: string;
  readonly databases: Readonly<Record<string, SavedDatabase>>;
  readonly localStorage: Readonly<Record<string, string>>;
}

export type ParseResult =
  | { readonly ok: true; readonly file: SaveFile }
  | { readonly ok: false; readonly error: string };

/** What a file holds, in the player's terms, for the confirm before an import replaces anything. */
export interface SaveFileSummary {
  readonly exportedAt: number;
  readonly appVersion: string;
  readonly games: number;
  readonly decks: number;
  readonly campaigns: number;
  /** Whether it carries unlock picks and points (`mc-unlocks`). */
  readonly unlocks: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasKey(record: Record<string, unknown>, keyPath: string | readonly string[]): boolean {
  const paths = typeof keyPath === "string" ? [keyPath] : keyPath;
  return paths.every((path) => {
    const value = record[path];
    return typeof value === "string" || typeof value === "number";
  });
}

function checkDatabase(spec: DatabaseSpec, raw: unknown): string | null {
  if (!isRecord(raw)) return `${spec.name} isn't a database snapshot`;
  const { version, stores } = raw;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return `${spec.name} has no schema version`;
  }
  if (version > spec.version) return `${spec.name} was saved by a newer version of the game`;
  if (!isRecord(stores)) return `${spec.name} has no stores`;
  for (const store of spec.stores) {
    const records = stores[store.name];
    // A store missing from the file restores empty: an older export may predate it.
    if (records === undefined) continue;
    if (!Array.isArray(records)) return `${spec.name}/${store.name} isn't a list`;
    if (!records.every((record) => isRecord(record) && hasKey(record, store.keyPath))) {
      return `${spec.name}/${store.name} has a record without its key`;
    }
  }
  return null;
}

/**
 * Reads a save-data file, checking everything an import is about to write: the envelope, each known database's
 * version and record keys, and the `localStorage` entries. Databases this build doesn't know are dropped rather
 * than refused, so a file from a build with an extra database still restores what this one can use.
 */
export function parseSaveFile(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file isn't a Marvel Champions save file." };
  }
  if (!isRecord(raw) || raw.format !== SAVE_FILE_FORMAT) {
    return { ok: false, error: "This file isn't a Marvel Champions save file." };
  }
  const { version, exportedAt, appVersion, databases, localStorage } = raw;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: "This save file has no format version." };
  }
  if (version > SAVE_FILE_VERSION) {
    return { ok: false, error: "This save file was made by a newer version of the game. Update, then try again." };
  }
  if (!isRecord(databases) || !isRecord(localStorage)) {
    return { ok: false, error: "This save file is incomplete." };
  }

  const known: Record<string, SavedDatabase> = {};
  for (const spec of SAVED_DATABASES) {
    const entry = databases[spec.name];
    if (entry === undefined) continue;
    const problem = checkDatabase(spec, entry);
    if (problem) return { ok: false, error: `This save file is damaged: ${problem}.` };
    known[spec.name] = entry as unknown as SavedDatabase;
  }

  const entries: Record<string, string> = {};
  for (const [key, value] of Object.entries(localStorage)) {
    if (!key.startsWith(SAVED_LOCAL_STORAGE_PREFIX) || typeof value !== "string") {
      return { ok: false, error: `This save file is damaged: unexpected setting "${key}".` };
    }
    entries[key] = value;
  }

  return {
    ok: true,
    file: {
      format: SAVE_FILE_FORMAT,
      version,
      exportedAt: typeof exportedAt === "number" ? exportedAt : 0,
      appVersion: typeof appVersion === "string" ? appVersion : "unknown",
      databases: known,
      localStorage: entries,
    },
  };
}

function countOf(file: SaveFile, database: string, store: string): number {
  return file.databases[database]?.stores[store]?.length ?? 0;
}

export function saveFileSummaryOf(file: SaveFile): SaveFileSummary {
  return {
    exportedAt: file.exportedAt,
    appVersion: file.appVersion,
    games: countOf(file, "mc-saves", "games"),
    decks: countOf(file, "mc-decks", "decks"),
    campaigns: countOf(file, "mc-campaigns", "campaigns"),
    unlocks: "mc-unlocks" in file.localStorage,
  };
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** One line for the import confirm: "3 saved games, 1 campaign and unlocks and points, exported 30 Sep 2026". */
export function describeSaveFileSummary(summary: SaveFileSummary, locale?: string): string {
  const parts = [
    summary.games ? plural(summary.games, "saved game") : null,
    summary.decks ? plural(summary.decks, "deck") : null,
    summary.campaigns ? plural(summary.campaigns, "campaign") : null,
    summary.unlocks ? "unlocks and points" : null,
  ].filter((part): part is string => part !== null);
  const what =
    parts.length === 0
      ? "nothing saved"
      : parts.length === 1
        ? parts[0]!
        : `${parts.slice(0, -1).join(", ")}, ${parts.at(-1)!}`;
  if (!summary.exportedAt) return what;
  const when = new Date(summary.exportedAt).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${what}, exported ${when}`;
}

/** `marvel-champions-save-2026-09-30.json`, dated by local time. */
export function saveFileNameOf(exportedAt: number): string {
  const date = new Date(exportedAt);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `marvel-champions-save-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}
