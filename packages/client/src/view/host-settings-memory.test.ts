import { describe, expect, it } from "vitest";
import {
  HOST_SETTINGS_KEY,
  hasKeptSettings,
  keepHostSettings,
  keptPartOf,
  readHostSettings,
} from "./host-settings-memory.js";

const memory = (): Pick<Storage, "getItem" | "setItem"> & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
};

describe("the host's kept room settings", () => {
  it("keeps each change the host makes, and brings them back together", () => {
    const storage = memory();
    keepHostSettings({ settings: { playMode: "host", undo: "own" } }, storage);
    keepHostSettings({ settings: { villainPacing: "each" } }, storage);
    keepHostSettings({ seats: 3 }, storage);
    expect(readHostSettings(storage)).toEqual({
      settings: { playMode: "host", undo: "own", villainPacing: "each" },
      seats: 3,
    });
  });

  it("leaves out what belongs to one room: its mods, house rules and mode", () => {
    expect(keptPartOf({ chat: false, mods: [], tableRules: { x: 1 }, mode: "epic" })).toEqual({ chat: false });
  });

  it("never keeps a public listing or cheats: each room chooses those afresh", () => {
    expect(keptPartOf({ listed: true, cheats: true, playMode: "host" })).toEqual({ playMode: "host" });
  });

  it("starts from nothing when nothing, or nothing readable, is kept", () => {
    const storage = memory();
    expect(hasKeptSettings(readHostSettings(storage))).toBe(false);
    storage.data.set(HOST_SETTINGS_KEY, "{not json");
    expect(readHostSettings(storage)).toEqual({ settings: {} });
    storage.data.set(HOST_SETTINGS_KEY, JSON.stringify({ settings: { chat: true }, seats: -2 }));
    expect(readHostSettings(storage)).toEqual({ settings: { chat: true } });
    expect(readHostSettings(null)).toEqual({ settings: {} });
  });
});
