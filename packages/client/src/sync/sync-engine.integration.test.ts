import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, test } from "vitest";
import { IdbGameStorage } from "../engine/idb-game-storage.js";
import type { KeyValueStorage } from "../save-data/save-data.js";
import { deriveCredentials } from "./sync-credentials.js";
import { SyncEngine } from "./sync-engine.js";
import { FakeServer } from "./sync-fakes.js";
import { IdbLocalSaveData } from "./sync-local.js";
import { IdbSyncStateStore } from "./sync-state.js";
import type { ConflictChoice, GameConflict } from "./sync-types.js";

const creds = await deriveCredentials("ABCDEFGHJKMNPQRSTUVWXYZ23");

class MapStorage implements KeyValueStorage {
  readonly map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

function device(server: FakeServer, answer: ConflictChoice) {
  const factory = new IDBFactory();
  const storage = new MapStorage();
  const games = new IdbGameStorage(factory);
  const local = new IdbLocalSaveData({
    indexedDB: factory,
    localStorage: storage,
    openGameId: () => null,
    newId: () => "copied-game",
  });
  const asked: GameConflict[] = [];
  const engine = new SyncEngine({
    credentials: creds,
    api: server.api,
    local,
    state: new IdbSyncStateStore(new IDBFactory()),
    resolveConflict: async (conflict) => {
      asked.push(conflict);
      return answer;
    },
  });
  return { games, storage, local, engine, asked };
}

const progress = (count: number, updatedAt: number) =>
  ({ round: 1 + Math.floor(count / 10), commandCount: count, updatedAt, status: "active", outcome: null }) as never;

async function play(d: ReturnType<typeof device>, id: string, from: number, to: number, tag: string, at: number) {
  if (from === 0) {
    const meta = {
      id,
      schema: 4,
      config: { scenarioId: "rhino" },
      createdAt: 1,
      updatedAt: at,
      status: "active",
      round: 1,
      commandCount: 0,
      outcome: null,
      campaignId: null,
      campaignNodeId: null,
    } as never;
    await d.games.create(meta, { marker: "baseline" } as never);
  }
  for (let seq = from; seq < to; seq++)
    await d.games.append(id, seq, { type: tag, n: seq } as never, progress(seq + 1, at));
}

describe("the engine over the real local layer", () => {
  test("a game and a setting travel from one device to another, then further play", async () => {
    const server = new FakeServer();
    const a = device(server, "keep-both");
    const b = device(server, "keep-both");
    await play(a, "g", 0, 70, "x", 2000);
    a.storage.setItem("mc-unlocks", '{"points":3}');
    const first = await a.engine.sync();
    expect(first.ok && first.pushed).toBe(5);
    const second = await b.engine.sync();
    expect(second.ok).toBe(true);
    expect(b.storage.getItem("mc-unlocks")).toBe('{"points":3}');
    expect((await b.local.snapshot()).map((r) => r.hash)).toEqual((await a.local.snapshot()).map((r) => r.hash));

    await play(a, "g", 70, 90, "x", 3000);
    await a.engine.sync();
    await b.engine.sync();
    expect((await b.local.snapshot()).map((r) => r.hash)).toEqual((await a.local.snapshot()).map((r) => r.hash));
    const quiet = await b.engine.sync();
    expect(quiet.ok && quiet.pushed + quiet.applied).toBe(0);
  });

  test("diverged games are asked about, and keep-both really copies the game", async () => {
    const server = new FakeServer();
    const a = device(server, "keep-both");
    const b = device(server, "keep-both");
    await play(a, "g", 0, 10, "x", 2000);
    await a.engine.sync();
    await b.engine.sync();
    await play(a, "g", 10, 20, "x", 3000);
    await play(b, "g", 10, 20, "y", 3500);
    await a.engine.sync();
    const result = await b.engine.sync();
    expect(result.ok && result.conflicts).toBe(1);
    expect(b.asked[0]).toMatchObject({ gameId: "g", campaign: false });
    const ids = (await b.local.snapshot()).filter((r) => r.key.endsWith(":meta")).map((r) => r.key);
    expect(ids).toEqual(["game:copied-game:meta", "game:g:meta"]);
    await a.engine.sync();
    expect((await a.local.snapshot()).map((r) => r.hash)).toEqual((await b.local.snapshot()).map((r) => r.hash));
  });
});
