/**
 * The persisted form of `Settings`: one `mc-settings` record in `localStorage`, so the save-data export/import
 * (`save-data/`, which carries every `mc-*` entry) moves it with no per-feature code.
 *
 * The record holds only what the player explicitly changed. `reducedMotion` and `textResolution` default from the
 * device (`defaultSettings`), so a field the player never touched is left out and keeps following whatever device
 * reads the record; storing the first device's default would freeze it. Parsing is tolerant in the same way as
 * `guide/guide-prefs.ts`: unknown fields are ignored, a missing or wrong-typed field falls back to its default, a
 * corrupt record is no record, and a newer `version` is read best-effort.
 */
import { SHARP_TEXT_RESOLUTION_CEILING, defaultSettings, type Settings } from "./settings.js";

export const SETTINGS_KEY = "mc-settings";
export const SETTINGS_VERSION = 1;

/** The fields the player has set; every other field follows `defaultSettings()`. */
export type SettingsOverrides = Partial<Settings>;

const BOOLEAN_FIELDS = [
  "reducedMotion",
  "largeCardText",
  "sound",
  "confirmBeforeEndTurn",
  "sameNameHeroAllyConflict",
] as const;

export function parseSettingsOverrides(raw: string | null): SettingsOverrides {
  if (raw === null) return {};
  let record: unknown;
  try {
    record = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof record !== "object" || record === null || Array.isArray(record)) return {};
  const source = record as Record<string, unknown>;
  const out: { -readonly [K in keyof Settings]?: Settings[K] } = {};
  for (const field of BOOLEAN_FIELDS) {
    const value = source[field];
    if (typeof value === "boolean") out[field] = value;
  }
  const resolution = source["textResolution"];
  if (typeof resolution === "number" && Number.isFinite(resolution)) {
    out.textResolution = Math.min(SHARP_TEXT_RESOLUTION_CEILING, Math.max(1, resolution));
  }
  return out;
}

export function serializeSettingsOverrides(overrides: SettingsOverrides): string {
  return JSON.stringify({ version: SETTINGS_VERSION, ...overrides });
}

/** The device's defaults with the player's explicit choices laid over them. */
export function resolveSettings(overrides: SettingsOverrides, defaults: Settings = defaultSettings()): Settings {
  return { ...defaults, ...overrides };
}

type SettingsStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): SettingsStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * The one write path: `set` is how every settings change reaches the session, and it saves. A field counts as
 * explicitly set once a `set` changes it.
 */
export class SettingsStore {
  #overrides: SettingsOverrides;
  #current: Settings;

  constructor(
    private readonly storage: SettingsStorage | null = browserStorage(),
    private readonly defaults: () => Settings = defaultSettings,
  ) {
    let raw: string | null = null;
    try {
      raw = this.storage?.getItem(SETTINGS_KEY) ?? null;
    } catch {
      raw = null;
    }
    this.#overrides = parseSettingsOverrides(raw);
    this.#current = resolveSettings(this.#overrides, this.defaults());
  }

  get current(): Settings {
    return this.#current;
  }

  set(next: Settings): void {
    const overrides: { -readonly [K in keyof Settings]?: Settings[K] } = { ...this.#overrides };
    for (const key of Object.keys(next) as (keyof Settings)[]) {
      if (next[key] !== this.#current[key]) (overrides as Record<string, unknown>)[key] = next[key];
    }
    this.#overrides = overrides;
    this.#current = next;
    try {
      this.storage?.setItem(SETTINGS_KEY, serializeSettingsOverrides(overrides));
    } catch {
      // Private mode or a full quota: the choice still holds for this session.
    }
  }
}
