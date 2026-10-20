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
import {
  ACHIEVEMENT_POPUP_PLACE_VALUES,
  ACHIEVEMENT_POPUP_TIME_VALUES,
  CARD_HOVER_SCALE_VALUES,
  CARD_SIZE_VALUES,
  DISPLAY_MODE_VALUES,
  FIRST_PLAYER_TOKEN_MOTION_VALUES,
  SHARP_TEXT_RESOLUTION_CEILING,
  VILLAIN_AUTO_ADVANCE_VALUES,
  VILLAIN_BEAT_SPEED_VALUES,
  FLIP_ENCOUNTER_SPEED_VALUES,
  clampMusicVolume,
  defaultSettings,
  resolutionPixelsOf,
  type Settings,
  type Resolution,
} from "./settings.js";

export const SETTINGS_KEY = "mc-settings";
export const SETTINGS_VERSION = 1;

/** The fields the player has set; every other field follows `defaultSettings()`. */
export type SettingsOverrides = Partial<Settings>;

const BOOLEAN_FIELDS = [
  "reducedMotion",
  "largeCardText",
  "sound",
  "musicShuffle",
  "confirmBeforeEndTurn",
  "sameNameHeroAllyConflict",
  "holdEncounterCards",
  "flipEncounterCards",
  "villainDockTable",
  "hoverHeroCard",
  "hoverVillainCard",
  "ultronDroneArt",
  "powerSavingAdjust",
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
  const autoAdvance = source["villainAutoAdvance"];
  const autoAdvanceValue = VILLAIN_AUTO_ADVANCE_VALUES.find((value) => value === autoAdvance);
  if (autoAdvanceValue !== undefined) out.villainAutoAdvance = autoAdvanceValue;
  const beatSpeed = source["villainBeatSpeed"];
  const beatSpeedValue = VILLAIN_BEAT_SPEED_VALUES.find((value) => value === beatSpeed);
  if (beatSpeedValue !== undefined) out.villainBeatSpeed = beatSpeedValue;
  const flipSpeedValue = FLIP_ENCOUNTER_SPEED_VALUES.find((value) => value === source["flipEncounterSpeed"]);
  if (flipSpeedValue !== undefined) out.flipEncounterSpeed = flipSpeedValue;
  const hoverScaleValue = CARD_HOVER_SCALE_VALUES.find((value) => value === source["cardHoverScale"]);
  if (hoverScaleValue !== undefined) out.cardHoverScale = hoverScaleValue;
  const cardSizeValue = CARD_SIZE_VALUES.find((value) => value === source["cardSize"]);
  if (cardSizeValue !== undefined) out.cardSize = cardSizeValue;
  const tokenMotionValue = FIRST_PLAYER_TOKEN_MOTION_VALUES.find((value) => value === source["firstPlayerTokenMotion"]);
  if (tokenMotionValue !== undefined) out.firstPlayerTokenMotion = tokenMotionValue;
  const popupTimeValue = ACHIEVEMENT_POPUP_TIME_VALUES.find((value) => value === source["achievementPopupTime"]);
  if (popupTimeValue !== undefined) out.achievementPopupTime = popupTimeValue;
  const popupPlaceValue = ACHIEVEMENT_POPUP_PLACE_VALUES.find((value) => value === source["achievementPopupPlace"]);
  if (popupPlaceValue !== undefined) out.achievementPopupPlace = popupPlaceValue;
  const displayModeValue = DISPLAY_MODE_VALUES.find((value) => value === source["displayMode"]);
  if (displayModeValue !== undefined) out.displayMode = displayModeValue;
  const drawResolution = source["resolution"];
  if (
    drawResolution === "native" ||
    (typeof drawResolution === "string" && resolutionPixelsOf(drawResolution) !== null)
  ) {
    out.resolution = drawResolution as Resolution;
  }
  const musicVolume = source["musicVolume"];
  if (typeof musicVolume === "number" && Number.isFinite(musicVolume)) out.musicVolume = clampMusicVolume(musicVolume);
  const effectsVolume = source["effectsVolume"];
  if (typeof effectsVolume === "number" && Number.isFinite(effectsVolume)) {
    out.effectsVolume = clampMusicVolume(effectsVolume);
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

  /**
   * Re-reads the device's defaults (power saving mode changed, `platform/power-saving.ts`): every field the player
   * never set follows them, and every field they did set stays as they set it. Saves nothing.
   */
  refreshDefaults(): Settings {
    this.#current = resolveSettings(this.#overrides, this.defaults());
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

/** What the player has explicitly set, read straight from storage (the desktop app's launch checks, `main.ts`). */
export function storedSettingsOverrides(storage: SettingsStorage | null = browserStorage()): SettingsOverrides {
  try {
    return parseSettingsOverrides(storage?.getItem(SETTINGS_KEY) ?? null);
  } catch {
    return {};
  }
}
