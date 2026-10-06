import { afterEach, describe, expect, test, vi } from "vitest";
import { MemoryGameStorage } from "./engine/game-storage.js";
import { EngineSessionCore } from "./engine/session-core.js";
import { defaultSettings, tableRulesOf, type Settings } from "./settings.js";
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
    ["confirmBeforeEndTurn", false],
    ["sameNameHeroAllyConflict", false],
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

describe("parseSettingsOverrides", () => {
  test("ignores unknown fields and falls back per field on wrong types", () => {
    expect(
      parseSettingsOverrides(
        JSON.stringify({ version: 1, sound: false, largeCardText: "yes", textResolution: "big", extra: 1 }),
      ),
    ).toEqual({ sound: false });
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

  test("serialize then parse round trips", () => {
    const overrides = { sound: false, textResolution: 1, reducedMotion: true };
    expect(parseSettingsOverrides(serializeSettingsOverrides(overrides))).toEqual(overrides);
    expect(resolveSettings({ sound: false }, defaultSettings()).sound).toBe(false);
  });
});
