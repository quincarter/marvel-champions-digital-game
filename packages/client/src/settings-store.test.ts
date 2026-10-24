import { afterEach, describe, expect, test, vi } from "vitest";
import { MemoryGameStorage } from "./engine/game-storage.js";
import { EngineSessionCore } from "./engine/session-core.js";
import { clampGlyphSize, defaultSettings, tableRulesOf, type Settings } from "./settings.js";
import {
  SETTINGS_KEY,
  SettingsStore,
  parseSettingsOverrides,
  resolveSettings,
  serializeSettingsOverrides,
} from "./settings-store.js";

class MapStorage {
  readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

/** A device: its `prefers-reduced-motion` answer and pixel ratio, as `defaultSettings` reads them. */
function device(reduced: boolean, ratio: number): () => Settings {
  return () => {
    vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
    vi.stubGlobal("devicePixelRatio", ratio);
    return defaultSettings();
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("SettingsStore", () => {
  test("power saving turns down only the settings the player never set, and puts them back after", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.stubGlobal("devicePixelRatio", 2);
    let powerSaving = false;
    const storage = new MapStorage();
    storage.setItem(SETTINGS_KEY, serializeSettingsOverrides({ textResolution: 2 }));
    const store = new SettingsStore(storage, () => defaultSettings({ powerSaving }));
    expect(store.current).toMatchObject({ reducedMotion: false, textResolution: 2 });
    powerSaving = true;
    // Reduced motion follows the mode; sharper text was the player's own choice, so it stays.
    expect(store.refreshDefaults()).toMatchObject({ reducedMotion: true, textResolution: 2 });
    expect(store.current.reducedMotion).toBe(true);
    // Changing something else while saving does not pin reduced motion on.
    store.set({ ...store.current, sound: false });
    powerSaving = false;
    expect(store.refreshDefaults()).toMatchObject({ reducedMotion: false, textResolution: 2, sound: false });
    expect(JSON.parse(storage.getItem(SETTINGS_KEY)!)).toEqual({ version: 1, textResolution: 2, sound: false });
  });

  test("power saving's defaults: reduced motion on and text at 1x", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.stubGlobal("devicePixelRatio", 3);
    expect(defaultSettings({ powerSaving: true })).toMatchObject({ reducedMotion: true, textResolution: 1 });
    expect(defaultSettings({ powerSaving: false })).toMatchObject({ reducedMotion: false, textResolution: 2 });
  });

  test("a fresh store has the device defaults and writes nothing", () => {
    const storage = new MapStorage();
    const store = new SettingsStore(storage, device(false, 1));
    expect(store.current).toEqual({ ...defaultSettings(), reducedMotion: false, textResolution: 1 });
    expect(storage.map.size).toBe(0);
  });

  test.each<[keyof Settings, Settings[keyof Settings]]>([
    ["reducedMotion", true],
    ["textResolution", 1],
    ["largeCardText", true],
    ["sound", false],
    ["musicShuffle", true],
    ["musicVolume", 35],
    ["glyphSize", 170],
    ["effectsVolume", 60],
    ["confirmBeforeEndTurn", false],
    ["sameNameHeroAllyConflict", false],
    ["villainAutoAdvance", "afterPause"],
    ["holdEncounterCards", false],
    ["discordPresence", false],
    ["flipEncounterCards", false],
    ["flipEncounterSpeed", "off"],
    ["villainBeatSpeed", "fast"],
    ["villainDockTable", false],
    ["cardHoverScale", "2.5x"],
    ["cardHoverScale", "off"],
    ["achievementPopupTime", "off"],
    ["achievementPopupTime", "10s"],
    ["achievementPopupPlace", "titleBar"],
    ["achievementPopupPlace", "bottom"],
    ["achievementPopupSize", "small"],
    ["achievementPopupSize", "large"],
  ])("%s survives a restart", (field, value) => {
    const storage = new MapStorage();
    const first = new SettingsStore(storage, device(false, 2));
    first.set({ ...first.current, [field]: value });
    expect(storage.map.has(SETTINGS_KEY)).toBe(true);
    const second = new SettingsStore(storage, device(false, 2));
    expect(second.current[field]).toBe(value);
  });

  test("every change is written, and only changed fields are stored", () => {
    const storage = new MapStorage();
    const store = new SettingsStore(storage, device(false, 2));
    store.set({ ...store.current, sound: false });
    expect(JSON.parse(storage.map.get(SETTINGS_KEY)!)).toEqual({ version: 1, sound: false });
    store.set({ ...store.current, largeCardText: true });
    expect(JSON.parse(storage.map.get(SETTINGS_KEY)!)).toEqual({ version: 1, sound: false, largeCardText: true });
    // Turning a field back to its default is still an explicit choice.
    store.set({ ...store.current, sound: true });
    expect(JSON.parse(storage.map.get(SETTINGS_KEY)!).sound).toBe(true);
  });

  test("device-derived fields follow the device until the player sets them", () => {
    const storage = new MapStorage();
    const a = new SettingsStore(storage, device(true, 1));
    a.set({ ...a.current, sound: false }); // touches neither device-derived field
    const onB = new SettingsStore(storage, device(false, 2));
    expect(onB.current.reducedMotion).toBe(false);
    expect(onB.current.textResolution).toBe(2);
    expect(onB.current.sound).toBe(false);

    // Once chosen, the choice travels instead.
    const c = new SettingsStore(storage, device(true, 1));
    c.set({ ...c.current, reducedMotion: false, textResolution: 2 });
    const onD = new SettingsStore(storage, device(true, 1));
    expect(onD.current.reducedMotion).toBe(false);
    expect(onD.current.textResolution).toBe(2);
  });

  test("works without localStorage and when it throws", () => {
    const store = new SettingsStore(null, device(false, 1));
    store.set({ ...store.current, sound: false });
    expect(store.current.sound).toBe(false);
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    const blocked = new SettingsStore(throwing, device(false, 1));
    blocked.set({ ...blocked.current, sound: false });
    expect(blocked.current.sound).toBe(false);
  });

  test("a saved game keeps the table rules it was created with when the setting changes", async () => {
    const storage = new MapStorage();
    const store = new SettingsStore(storage, device(false, 1));
    expect(store.current.sameNameHeroAllyConflict).toBe(true);
    const games = new MemoryGameStorage();
    const started = await new EngineSessionCore({ storage: games }).start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 7,
      ...(tableRulesOf(store.current) ? { tableRules: tableRulesOf(store.current)! } : {}),
    });
    expect(started.snapshot.state.tableRules).toEqual({ sameNameHeroAllyConflict: true });

    store.set({ ...store.current, sameNameHeroAllyConflict: false });
    const relaunched = new SettingsStore(storage, device(false, 1));
    expect(relaunched.current.sameNameHeroAllyConflict).toBe(false);

    const saved = await games.latestActive();
    const resumed = await new EngineSessionCore({ storage: games }).resume(saved!.id);
    expect(resumed.snapshot.state.tableRules).toEqual({ sameNameHeroAllyConflict: true });
    expect(resumed.snapshot.state).toEqual(started.snapshot.state);
  });
});

describe("keyboardHand", () => {
  test("defaults to the left hand and persists a right-hand choice", () => {
    expect(defaultSettings().keyboardHand).toBe("left");
    expect(parseSettingsOverrides('{"keyboardHand":"right"}')).toEqual({ keyboardHand: "right" });
    expect(parseSettingsOverrides('{"keyboardHand":"both"}')).toEqual({});
    const saved = serializeSettingsOverrides({ ...defaultSettings(), keyboardHand: "right" });
    expect(parseSettingsOverrides(saved).keyboardHand).toBe("right");
  });
});

describe("parseSettingsOverrides", () => {
  test("ignores unknown fields and falls back per field on wrong types", () => {
    expect(
      parseSettingsOverrides(
        JSON.stringify({ version: 1, sound: false, largeCardText: "yes", textResolution: "big", extra: 1 }),
      ),
    ).toEqual({ sound: false });
  });

  test("villain phase fields: wrong types and unknown enum values fall back to default", () => {
    expect(
      parseSettingsOverrides(
        JSON.stringify({
          villainAutoAdvance: "sometimes",
          villainBeatSpeed: 3,
          holdEncounterCards: "no",
          villainDockTable: 1,
        }),
      ),
    ).toEqual({});
    expect(
      parseSettingsOverrides('{"villainAutoAdvance":"on","villainBeatSpeed":"slow","holdEncounterCards":false}'),
    ).toEqual({
      villainAutoAdvance: "on",
      villainBeatSpeed: "slow",
      holdEncounterCards: false,
    });
  });

  test("firstPlayerTokenMotion: only the five known styles are read", () => {
    expect(parseSettingsOverrides('{"firstPlayerTokenMotion":"spin"}')).toEqual({ firstPlayerTokenMotion: "spin" });
    expect(parseSettingsOverrides('{"firstPlayerTokenMotion":"juggle"}')).toEqual({});
  });

  test("displayMode: only the three window modes are read", () => {
    expect(parseSettingsOverrides('{"displayMode":"borderless"}')).toEqual({ displayMode: "borderless" });
    expect(parseSettingsOverrides('{"displayMode":"exclusive"}')).toEqual({});
  });

  test("resolution: 'default' or a width x height is read, anything else is not", () => {
    expect(parseSettingsOverrides('{"resolution":"1920x1080"}')).toEqual({ resolution: "1920x1080" });
    expect(parseSettingsOverrides('{"resolution":"native"}')).toEqual({ resolution: "native" });
    expect(parseSettingsOverrides('{"resolution":"big"}')).toEqual({});
    expect(parseSettingsOverrides('{"resolution":1920}')).toEqual({});
  });

  test("cardSize: only the three known values are read", () => {
    expect(parseSettingsOverrides('{"cardSize":"xlarge"}')).toEqual({ cardSize: "xlarge" });
    expect(parseSettingsOverrides('{"cardSize":"large"}')).toEqual({ cardSize: "large" });
    expect(parseSettingsOverrides('{"cardSize":1.5}')).toEqual({});
    expect(parseSettingsOverrides('{"cardSize":"huge"}')).toEqual({});
  });

  test("inspectCard: large or sideBySide are read, anything else falls back to the default (#358)", () => {
    expect(parseSettingsOverrides('{"inspectCard":"sideBySide"}')).toEqual({ inspectCard: "sideBySide" });
    expect(parseSettingsOverrides('{"inspectCard":"large"}')).toEqual({ inspectCard: "large" });
    expect(parseSettingsOverrides('{"inspectCard":"small"}')).toEqual({});
    expect(parseSettingsOverrides('{"inspectCard":true}')).toEqual({});
  });

  test("cardHoverScale: only the five known values are read (a saved 5x falls back to the default)", () => {
    expect(parseSettingsOverrides('{"cardHoverScale":"1.5x"}')).toEqual({ cardHoverScale: "1.5x" });
    expect(parseSettingsOverrides('{"cardHoverScale":"off"}')).toEqual({ cardHoverScale: "off" });
    expect(parseSettingsOverrides('{"cardHoverScale":3}')).toEqual({});
    expect(parseSettingsOverrides('{"cardHoverScale":"4x"}')).toEqual({ cardHoverScale: "4x" });
    expect(parseSettingsOverrides('{"cardHoverScale":"5x"}')).toEqual({});
  });

  test.each([null, "", "{nope", "42", "null", "[1]"])("%j is no record", (raw) => {
    expect(parseSettingsOverrides(raw)).toEqual({});
  });

  test("a newer version is read best-effort", () => {
    expect(parseSettingsOverrides('{"version":99,"sound":false,"newThing":true}')).toEqual({ sound: false });
  });

  test("text resolution is clamped to the sharp range", () => {
    expect(parseSettingsOverrides('{"textResolution":9}')).toEqual({ textResolution: 2 });
    expect(parseSettingsOverrides('{"textResolution":0}')).toEqual({ textResolution: 1 });
  });

  test("hint size is read as a step of 5 from 75 to 200, default 130", () => {
    expect(parseSettingsOverrides('{"glyphSize":162}')).toEqual({ glyphSize: 160 });
    expect(parseSettingsOverrides('{"glyphSize":500}')).toEqual({ glyphSize: 200 });
    expect(parseSettingsOverrides('{"glyphSize":10}')).toEqual({ glyphSize: 75 });
    expect(parseSettingsOverrides('{"glyphSize":"big"}')).toEqual({});
    expect(defaultSettings().glyphSize).toBe(130);
    expect(clampGlyphSize(Number.NaN)).toBe(130);
  });

  test("music volume is read as a whole percent from 0 to 100 (#243)", () => {
    expect(parseSettingsOverrides('{"musicVolume":42.4}')).toEqual({ musicVolume: 42 });
    expect(parseSettingsOverrides('{"musicVolume":250}')).toEqual({ musicVolume: 100 });
    expect(parseSettingsOverrides('{"musicVolume":-3}')).toEqual({ musicVolume: 0 });
    expect(parseSettingsOverrides('{"musicVolume":"loud"}')).toEqual({});
    expect(defaultSettings().musicVolume).toBe(100);
    expect(parseSettingsOverrides('{"effectsVolume":180}')).toEqual({ effectsVolume: 100 });
    expect(defaultSettings().effectsVolume).toBe(100);
  });

  test("serialize then parse round trips", () => {
    const overrides = { sound: false, textResolution: 1, reducedMotion: true };
    expect(parseSettingsOverrides(serializeSettingsOverrides(overrides))).toEqual(overrides);
    expect(resolveSettings({ sound: false }, defaultSettings()).sound).toBe(false);
  });
});

describe("couch mode in the saved record", () => {
  test("a known choice is read back and anything else falls to the default", () => {
    expect(parseSettingsOverrides(serializeSettingsOverrides({ couchMode: "150%" })).couchMode).toBe("150%");
    expect(parseSettingsOverrides(JSON.stringify({ couchMode: "300%" })).couchMode).toBe(undefined);
  });
});
