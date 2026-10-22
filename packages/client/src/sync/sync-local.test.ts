import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, test, vi } from "vitest";
import { IdbCampaignStorage } from "../engine/idb-campaign-storage.js";
import { IdbDeckStorage } from "../engine/idb-deck-storage.js";
import { IdbGameStorage } from "../engine/idb-game-storage.js";
import { SAVED_DATABASES, type DatabaseSpec } from "../save-data/databases.js";
import type { KeyValueStorage } from "../save-data/save-data.js";
import { IdbLocalSaveData, SYNC_EXCLUDED_KEYS, canonicalJson, hashValue, isCampaignGame } from "./sync-local.js";
import { LOG_CHUNK, type LogicalRecord } from "./sync-types.js";

class MapStorage implements KeyValueStorage {
  readonly map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

interface Device {
  readonly factory: IDBFactory;
  readonly storage: MapStorage;
  readonly games: IdbGameStorage;
  open: string | null;
  readonly local: IdbLocalSaveData;
}

function device(databases?: readonly DatabaseSpec[], ids: string[] = []): Device {
  const factory = new IDBFactory();
  const storage = new MapStorage();
  const d: Device = {
    factory,
    storage,
    games: new IdbGameStorage(factory),
    open: null,
    local: new IdbLocalSaveData({
      indexedDB: factory,
      localStorage: storage,
      openGameId: () => d.open,
      ...(databases ? { databases } : {}),
      newId: () => ids.shift() ?? "copy-id",
    }),
  };
  return d;
}

const progress = (count: number, updatedAt: number) =>
  ({ round: 1 + Math.floor(count / 10), commandCount: count, updatedAt, status: "active", outcome: null }) as never;

async function makeGame(
  d: Device,
  id: string,
  commands: number,
  updatedAt = 1000,
  status: "active" | "abandoned" = "active",
) {
  const meta = {
    id,
    schema: 4,
    config: { scenario: "x" },
    createdAt: 1,
    updatedAt,
    status,
    round: 1,
    commandCount: 0,
    outcome: null,
    campaignId: null,
    campaignNodeId: null,
  } as never;
  await d.games.create(meta, { marker: `baseline-${id}` } as never);
  for (let seq = 0; seq < commands; seq++) {
    await d.games.append(id, seq, { type: "cmd", n: seq } as never, progress(seq + 1, updatedAt));
  }
}

const byKey = (records: readonly LogicalRecord[]) => new Map(records.map((r) => [r.key, r]));
const toWrite = (records: readonly LogicalRecord[]) => records.map(({ key, value }) => ({ key, value }));

describe("IdbLocalSaveData", () => {
  test("snapshot maps a game to meta, baseline and log chunks, and everything else per row", async () => {
    const d = device();
    await makeGame(d, "g1", 3, 5000);
    await new IdbDeckStorage(d.factory).put({ id: "d1", name: "Deck" } as never);
    await new IdbCampaignStorage(d.factory).put({ id: "c1", updatedAt: 777 } as never);
    d.storage.setItem("mc-unlocks", "{}");
    d.storage.setItem("other", "no");

    const records = byKey(await d.local.snapshot());
    expect([...records.keys()].sort()).toEqual([
      "db:mc-campaigns:campaigns:c1",
      "db:mc-decks:decks:d1",
      "game:g1:baseline",
      "game:g1:log:0",
      "game:g1:meta",
      "ls:mc-unlocks",
    ]);
    expect(records.get("game:g1:meta")?.stamp).toBe(5000);
    expect(records.get("game:g1:log:0")?.stamp).toBe(5000);
    expect(records.get("db:mc-campaigns:campaigns:c1")?.stamp).toBe(777);
    expect(records.get("db:mc-decks:decks:d1")?.stamp).toBe(0);
    expect(records.get("ls:mc-unlocks")?.value).toBe("{}");
    expect((records.get("game:g1:log:0")!.value as { commands: unknown[] }).commands).toHaveLength(3);
    expect((records.get("game:g1:meta")!.value as { logHash: string }).logHash).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  test("retiring a game stamps its meta as newer, so a status-only change syncs as the newer side", async () => {
    const d = device();
    await makeGame(d, "g1", 3, 5000);
    const before = byKey(await d.local.snapshot());
    await d.games.setStatus("g1", "abandoned", 9000);
    const after = byKey(await d.local.snapshot());
    expect(after.get("game:g1:meta")?.stamp).toBe(9000);
    expect((after.get("game:g1:meta")!.value as { status: string }).status).toBe("abandoned");
    expect(after.get("game:g1:meta")?.hash).not.toBe(before.get("game:g1:meta")?.hash);
    // The log itself is the same, so this is no conflict: the log hash the meta carries is unchanged.
    expect((after.get("game:g1:meta")!.value as { logHash: string }).logHash).toBe(
      (before.get("game:g1:meta")!.value as { logHash: string }).logHash,
    );
    expect(after.get("game:g1:log:0")?.hash).toBe(before.get("game:g1:log:0")?.hash);
  });

  test("a game this build marks incompatible is still reported as active, so that mark is never pushed", async () => {
    const d = device();
    await makeGame(d, "g1", 2, 5000);
    const before = byKey(await d.local.snapshot());
    await d.games.setStatus("g1", "incompatible");
    const after = byKey(await d.local.snapshot());
    expect((after.get("game:g1:meta")!.value as { status: string }).status).toBe("active");
    expect(after.get("game:g1:meta")?.hash).toBe(before.get("game:g1:meta")?.hash);
    expect(after.get("game:g1:meta")?.stamp).toBe(5000);
  });

  test("hashes are stable under key order and differ when the value does", async () => {
    expect(canonicalJson({ b: 1, a: { d: 1, c: 2 } })).toBe(canonicalJson({ a: { c: 2, d: 1 }, b: 1 }));
    expect(await hashValue({ a: 1, b: 2 })).toBe(await hashValue({ b: 2, a: 1 }));
    expect(await hashValue({ a: 1 })).not.toBe(await hashValue({ a: 2 }));
  });

  test("a snapshot applied to an empty device snapshots equal, and the game loads", async () => {
    const from = device();
    await makeGame(from, "g1", 70, 4000);
    await makeGame(from, "g2", 2, 3000, "abandoned");
    await new IdbDeckStorage(from.factory).put({ id: "d1", name: "Deck" } as never);
    from.storage.setItem("mc-guide", "x");
    const snapshot = await from.local.snapshot();

    const to = device();
    await to.local.apply(toWrite(snapshot), []);
    const again = await to.local.snapshot();
    expect(again.map((r) => [r.key, r.hash, r.stamp])).toEqual(snapshot.map((r) => [r.key, r.hash, r.stamp]));
    expect(to.storage.getItem("mc-guide")).toBe("x");
    const loaded = await new IdbGameStorage(to.factory).load("g1");
    expect(loaded?.commands).toHaveLength(70);
    expect(loaded?.commands[69]).toEqual({ type: "cmd", n: 69 });
    expect(Object.keys(loaded!.meta)).not.toContain("logHash");
  });

  test.each([
    [63, 1],
    [64, 1],
    [65, 2],
    [0, 0],
  ])("%i commands make %i chunks", async (count, chunks) => {
    const d = device();
    await makeGame(d, "g", count);
    const records = await d.local.snapshot();
    expect(records.filter((r) => r.key.startsWith("game:g:log:"))).toHaveLength(chunks);
    const to = device();
    await to.local.apply(toWrite(records), []);
    expect((await new IdbGameStorage(to.factory).load("g"))?.commands).toHaveLength(count);
    expect(LOG_CHUNK).toBe(64);
  });

  test("a remote truncate shortens the local log, including whole chunks", async () => {
    const a = device();
    const b = device();
    await makeGame(a, "g", 130, 100);
    await b.local.apply(toWrite(await a.local.snapshot()), []);
    expect((await new IdbGameStorage(b.factory).load("g"))?.commands).toHaveLength(130);

    await a.games.truncate("g", 70, progress(70, 200));
    const after = byKey(await a.local.snapshot());
    expect(after.has("game:g:log:2")).toBe(false);
    await b.local.apply(
      [after.get("game:g:meta")!, after.get("game:g:log:1")!].map(({ key, value }) => ({ key, value })),
      ["game:g:log:2"],
    );
    const loaded = await new IdbGameStorage(b.factory).load("g");
    expect(loaded?.commands).toHaveLength(70);
    expect(loaded?.meta.commandCount).toBe(70);
    expect(byKey(await b.local.snapshot()).get("game:g:meta")?.hash).toBe(after.get("game:g:meta")?.hash);

    // Down to a chunk boundary: the now-empty chunk is deleted.
    await a.games.truncate("g", 64, progress(64, 300));
    const boundary = byKey(await a.local.snapshot());
    await b.local.apply([{ key: "game:g:meta", value: boundary.get("game:g:meta")!.value }], ["game:g:log:1"]);
    expect((await new IdbGameStorage(b.factory).load("g"))?.commands).toHaveLength(64);
  });

  test("deleting a game's meta removes the whole game; other deletes remove their row or entry", async () => {
    const d = device();
    await makeGame(d, "g", 70);
    await makeGame(d, "h", 2);
    await new IdbDeckStorage(d.factory).put({ id: "d1" } as never);
    d.storage.setItem("mc-guide", "x");
    d.storage.setItem("keep", "y");
    await d.local.apply([], ["game:g:meta", "db:mc-decks:decks:d1", "ls:mc-guide"]);
    const keys = (await d.local.snapshot()).map((r) => r.key);
    expect(keys.some((k) => k.startsWith("game:g:"))).toBe(false);
    expect(keys.filter((k) => k.startsWith("game:h:"))).toHaveLength(3);
    expect(keys.some((k) => k.startsWith("db:"))).toBe(false);
    expect(d.storage.getItem("mc-guide")).toBeNull();
    expect(d.storage.getItem("keep")).toBe("y");
    expect(await new IdbGameStorage(d.factory).load("g")).toBeNull();
  });

  test("localStorage entries round trip; per-device and non-mc keys are neither sent nor applied", async () => {
    const d = device();
    await d.local.apply([{ key: "ls:mc-guide", value: '{"a":1}' }], []);
    expect(d.storage.getItem("mc-guide")).toBe('{"a":1}');
    for (const key of ["mc-settings", "evil"]) {
      await expect(d.local.apply([{ key: `ls:${key}`, value: "x" }], [])).rejects.toThrow(/does not carry/);
    }
    for (const key of SYNC_EXCLUDED_KEYS) d.storage.setItem(key, "device");
    expect(SYNC_EXCLUDED_KEYS.has("mc-settings") && SYNC_EXCLUDED_KEYS.has("mc-break-time-start")).toBe(true);
    expect((await d.local.snapshot()).map((r) => r.key)).toEqual(["ls:mc-guide"]);
  });

  test("the open game is refused, for writes and deletes, and nothing else is written either", async () => {
    const d = device();
    await makeGame(d, "g", 2);
    d.open = "g";
    const meta = (await d.local.snapshot()).find((r) => r.key === "game:g:meta")!;
    await expect(
      d.local.apply(
        [
          { key: "game:g:log:0", value: { commands: [] } },
          { key: "ls:mc-a", value: "1" },
        ],
        [],
      ),
    ).rejects.toThrow(/being played/);
    await expect(d.local.apply([], ["game:g:meta"])).rejects.toThrow(/being played/);
    expect(d.storage.getItem("mc-a")).toBeNull();
    expect((await new IdbGameStorage(d.factory).load("g"))?.commands).toHaveLength(2);
    d.open = "other";
    await d.local.apply([{ key: meta.key, value: meta.value }], []);
  });

  test("records of an unknown database or store are ignored", async () => {
    const d = device();
    await d.local.apply(
      [
        { key: "db:mc-future:things:1", value: { id: "1" } },
        { key: "db:mc-decks:gadgets:1", value: { id: "1" } },
        { key: "db:mc-decks:decks:d1", value: { id: "d1" } },
      ],
      ["db:mc-future:things:2"],
    );
    expect((await d.local.snapshot()).map((r) => r.key)).toEqual(["db:mc-decks:decks:d1"]);
  });

  test("copyGame writes a fresh id and keeps the status, beside the other active game", async () => {
    const a = device();
    await makeGame(a, "g", 70);
    const records = toWrite(await a.local.snapshot());

    const b = device(undefined, ["new-1"]);
    await makeGame(b, "mine", 1);
    expect(await b.local.copyGame(records)).toBe("new-1");
    const copy = await new IdbGameStorage(b.factory).load("new-1");
    expect(copy?.meta.id).toBe("new-1");
    expect(copy?.meta.status).toBe("active");
    expect(copy?.commands).toHaveLength(70);
    const rows = byKey(await b.local.snapshot());
    expect((rows.get("game:new-1:baseline")!.value as { gameId: string }).gameId).toBe("new-1");
    expect((await new IdbGameStorage(b.factory).load("mine"))?.meta.status).toBe("active");
    expect(await new IdbGameStorage(b.factory).load("g")).toBeNull();

    // With nothing else active, the copy keeps its status.
    const c = device(undefined, ["only"]);
    await c.local.copyGame(records);
    expect((await new IdbGameStorage(c.factory).load("only"))?.meta.status).toBe("active");
  });

  test("a store added to the spec list is picked up with no code change, compound keys included", async () => {
    const specs: DatabaseSpec[] = [
      ...SAVED_DATABASES,
      {
        name: "mc-extras",
        version: 1,
        stores: [
          { name: "notes", keyPath: ["owner", "n"] },
          { name: "tags", keyPath: "tag" },
        ],
      },
    ];
    const from = device(specs);
    await from.local.apply(
      [
        { key: "db:mc-extras:notes:ann/#3", value: { owner: "ann", n: 3, text: "hi", updatedAt: 9 } },
        { key: "db:mc-extras:tags:red", value: { tag: "red" } },
      ],
      [],
    );
    const records = byKey(await from.local.snapshot());
    expect([...records.keys()]).toEqual(["db:mc-extras:notes:ann/#3", "db:mc-extras:tags:red"]);
    expect(records.get("db:mc-extras:notes:ann/#3")?.stamp).toBe(9);

    const to = device(specs);
    await to.local.apply(toWrite([...records.values()]), []);
    expect((await to.local.snapshot()).map((r) => r.hash)).toEqual([...records.values()].map((r) => r.hash));
    await to.local.apply([], ["db:mc-extras:notes:ann/#3"]);
    expect((await to.local.snapshot()).map((r) => r.key)).toEqual(["db:mc-extras:tags:red"]);
  });

  test("a failed record aborts the database's whole share", async () => {
    const d = device();
    await new IdbDeckStorage(d.factory).put({ id: "d1" } as never);
    await expect(
      d.local.apply([{ key: "db:mc-decks:decks:d2", value: { name: "no id" } }], ["db:mc-decks:decks:d1"]),
    ).rejects.toThrow();
    expect((await new IdbDeckStorage(d.factory).list()).map((x) => x.id)).toEqual(["d1"]);
  });

  test("malformed or misdirected records are refused before anything is written", async () => {
    const d = device();
    const deck = { key: "db:mc-decks:decks:d1", value: { id: "d1" } };
    await expect(d.local.apply([deck, { key: "game:g:meta", value: { id: "other" } }], [])).rejects.toThrow(
      /another game/,
    );
    await expect(d.local.apply([deck, { key: "game:g:baseline", value: { gameId: "x" } }], [])).rejects.toThrow();
    const big = { commands: Array.from({ length: LOG_CHUNK + 1 }, () => 1) };
    await expect(d.local.apply([deck, { key: "game:g:log:0", value: big }], [])).rejects.toThrow(/log chunk/);
    await expect(d.local.apply([deck, { key: "db:mc-saves:games:g", value: { id: "g" } }], [])).rejects.toThrow();
    expect(await new IdbDeckStorage(d.factory).list()).toEqual([]);
  });

  test("a game opened while apply was starting is still refused", async () => {
    const d = device();
    await makeGame(d, "g", 1, 10, "abandoned");
    const meta = (await d.local.snapshot()).find((r) => r.key === "game:g:meta")!;
    let calls = 0;
    d.open = null;
    const racing = new IdbLocalSaveData({
      indexedDB: d.factory,
      localStorage: d.storage,
      openGameId: () => (++calls === 1 ? null : "g"),
    });
    await expect(racing.apply([{ key: meta.key, value: meta.value }], [])).rejects.toThrow(/being played/);
  });

  test("copyGame refuses a campaign game", async () => {
    const d = device();
    await makeGame(d, "g", 1);
    const records = toWrite(await d.local.snapshot());
    const campaign = records.map((r) =>
      r.key === "game:g:meta" ? { ...r, value: { ...(r.value as object), campaignId: "c1" } } : r,
    );
    expect(isCampaignGame(campaign)).toBe(true);
    expect(isCampaignGame(records)).toBe(false);
    await expect(d.local.copyGame(campaign)).rejects.toThrow(/campaign/);
  });

  test("an unchanged game's baseline and log are not read again, a changed one's are", async () => {
    const d = device();
    await makeGame(d, "g1", 70, 100, "abandoned");
    await makeGame(d, "g2", 5, 200);
    const first = await d.local.snapshot();
    const spy = vi.spyOn(IDBObjectStore.prototype, "getAll");
    try {
      const commandReads = () =>
        spy.mock.contexts.filter((store) => (store as IDBObjectStore).name === "commands").length;
      expect(commandReads()).toBe(0);
      const second = await d.local.snapshot();
      expect(commandReads()).toBe(0);
      expect(second).toEqual(first);
      await d.games.append("g2", 5, { type: "cmd", n: 5 } as never, progress(6, 300));
      const third = await d.local.snapshot();
      expect(commandReads()).toBe(1);
      expect(third.find((r) => r.key === "game:g1:log:1")).toEqual(first.find((r) => r.key === "game:g1:log:1"));
      expect(third.find((r) => r.key === "game:g2:meta")?.hash).not.toBe(
        first.find((r) => r.key === "game:g2:meta")?.hash,
      );
      // Applying a game drops it from the cache, so the next snapshot reads it.
      await d.local.apply([], ["game:g1:meta"]);
      expect((await d.local.snapshot()).some((r) => r.key.startsWith("game:g1:"))).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  test("a remote active game leaves every local active game in progress", async () => {
    const remote = device();
    await makeGame(remote, "r", 1, 500);
    const records = toWrite(await remote.local.snapshot());

    const d = device();
    await makeGame(d, "old", 1, 100);
    await d.local.apply(records, []);
    const storage = new IdbGameStorage(d.factory);
    expect((await storage.load("old"))?.meta.status).toBe("active");
    expect((await storage.load("r"))?.meta.status).toBe("active");

    const e = device();
    await makeGame(e, "newer", 1, 900);
    await e.local.apply(records, []);
    expect((await new IdbGameStorage(e.factory).load("newer"))?.meta.status).toBe("active");
  });

  test("numeric and awkward key parts survive a round trip and delete exactly", async () => {
    const specs: DatabaseSpec[] = [
      {
        name: "mc-extras",
        version: 1,
        stores: [
          { name: "n", keyPath: "id" },
          { name: "c", keyPath: ["a", "b"] },
        ],
      },
    ];
    const d = device(specs);
    const rows = [
      { key: "db:mc-extras:n:#5", value: { id: 5 } },
      { key: "db:mc-extras:n:5", value: { id: "5" } },
      { key: "db:mc-extras:c:x%2Fy/#1", value: { a: "x/y", b: 1 } },
    ];
    await d.local.apply(rows, []);
    expect((await d.local.snapshot()).map((r) => r.key).sort()).toEqual(rows.map((r) => r.key).sort());
    await d.local.apply([], ["db:mc-extras:n:#5"]);
    expect((await d.local.snapshot()).map((r) => r.key).sort()).toEqual([
      "db:mc-extras:c:x%2Fy/#1",
      "db:mc-extras:n:5",
    ]);
  });
});

describe("row stamps", () => {
  test("a deck's ISO updatedAt string is its stamp in milliseconds; a bad one is 0", async () => {
    const d = device();
    const iso = "2026-10-20T12:00:00.000Z";
    await new IdbDeckStorage(d.factory).put({ id: "d1", name: "Deck", updatedAt: iso } as never);
    await new IdbDeckStorage(d.factory).put({ id: "d2", name: "Deck", updatedAt: "not a date" } as never);
    const records = byKey(await d.local.snapshot());
    expect(records.get("db:mc-decks:decks:d1")?.stamp).toBe(Date.parse(iso));
    expect(records.get("db:mc-decks:decks:d2")?.stamp).toBe(0);
  });
});
