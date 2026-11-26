import { describe, expect, it } from "vitest";
import type { LobbySettings } from "@mc/sync-worker/room-protocol";
import {
  HOST_SETTINGS_KEY,
  hasKeptSettings,
  keepHostSettings,
  keptFromRoom,
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

describe("keptFromRoom (#1019 review)", () => {
  const base: LobbySettings = {
    playMode: "host",
    undo: "ask",
    cheats: false,
    tableRules: {},
    mods: [],
    multiSeat: false,
    chat: true,
    appVersion: "1",
    contentVersion: "1",
  };
  const at = (settings: LobbySettings | null, seats = 2) => ({ settings, seats: Array.from({ length: seats }) });

  it("keeps the room's normalized settings, not the change as sent", () => {
    // Ask the host, then Strict, then Host control again: the room starts the new Host control at Each player.
    const strict: LobbySettings = { ...base, playMode: "strict", undo: "off" };
    const back: LobbySettings = { ...base, undo: "own" };
    const storage = memory();
    for (const [prev, next] of [
      [at(base), at(strict)],
      [at(strict), at(back)],
    ] as const) {
      const kept = keptFromRoom(prev, next, true);
      if (kept) keepHostSettings(kept, storage);
    }
    expect(readHostSettings(storage).settings).toMatchObject({ playMode: "host", undo: "own" });
  });

  it("keeps nothing before the host changes anything, or when nothing changed (a refused change)", () => {
    expect(keptFromRoom(at(base), at({ ...base, chat: false }), false)).toBeNull();
    const same = at(base);
    expect(keptFromRoom(same, { ...same }, true)).toBeNull();
    expect(keptFromRoom(at(base, 2), at(base, 3), true)?.seats).toBe(3);
  });
});
