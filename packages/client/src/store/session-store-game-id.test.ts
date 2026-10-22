import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import type { SessionConfig } from "../engine/host.js";
import { SessionStore } from "./session-store.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 2026,
};

describe("SessionState.gameId (what device sync must not overwrite)", () => {
  test("is the stored id from the first update, stays through commands and a rewind, and resets on the next begin", async () => {
    const storage = new MemoryGameStorage();
    const store = new SessionStore(new LocalEngineHost(storage));
    expect(store.state.gameId).toBeNull();
    await store.start(RHINO_SOLO);
    const id = store.state.gameId;
    expect(id).toEqual(expect.any(String));
    expect((await storage.list()).map((g) => g.id)).toEqual([id]);

    expect(await store.resolveChoice([])).toBe(true);
    expect(store.state.gameId).toBe(id);
    expect(await store.rewindTo(0)).toBe(true);
    expect(store.state.gameId).toBe(id);

    // Starting another game replaces it; a resume names the resumed one.
    await store.start({ ...RHINO_SOLO, seed: 7 });
    const second = store.state.gameId;
    expect(second).not.toBe(id);
    await store.resume(id!);
    expect(store.state.gameId).toBe(id);
  });

  test("is null for a game that is not being saved", async () => {
    const store = new SessionStore(new LocalEngineHost(null as never));
    await store.start(RHINO_SOLO).catch(() => undefined);
    expect(store.state.gameId ?? null).toBeNull();
  });
});
