/**
 * Device sync across mixed app versions (#276 step 2): the web updates at once while the desktop and Android shells lag,
 * so an OLDER build routinely meets what a NEWER one wrote. It must never damage it: keep a newer database's records
 * untouched, let the newer writer win over its own edit of a shared record, and never push a game it cannot play.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, test } from "vitest";
import { EngineSessionCore, NEWER_SAVE_MESSAGE } from "../engine/session-core.js";
import { IdbGameStorage } from "../engine/idb-game-storage.js";
import type { KeyValueStorage } from "../save-data/save-data.js";
import { deriveCredentials } from "./sync-credentials.js";
import { SyncEngine, type SyncEngineDeps, type SyncRunResult } from "./sync-engine.js";
import { FakeLocal, FakeServer, FakeState } from "./sync-fakes.js";
import { IdbLocalSaveData } from "./sync-local.js";
import { openRecord } from "./sync-records.js";
import { IdbSyncStateStore } from "./sync-state.js";
import type { GameConflict, LocalSaveData, SyncStateStore } from "./sync-types.js";

const creds = await deriveCredentials("ABCDEFGHJKMNPQRSTUVWXYZ23");

const OLD = "1.0.0";
const NEW = "9.0.0";
let clock = 10_000;

function ok(result: SyncRunResult) {
  if (!result.ok) throw new Error(`sync failed: ${JSON.stringify(result.failure)}`);
  return result;
}

function engineFor(
  server: FakeServer,
  local: LocalSaveData,
  state: SyncStateStore,
  version: string,
  extra: Partial<SyncEngineDeps> = {},
) {
  return new SyncEngine({
    credentials: creds,
    api: server.api,
    local,
    state,
    now: () => clock,
    resolveConflict: async () => "keep-local",
    clientVersion: version,
    contentVersion: `pool-${version}`,
    ...extra,
  });
}

/** A device on `version` (and, for a newer build, database version 2 for every database). */
function device(
  server: FakeServer,
  version: string,
  databaseVersion: (database: string) => number = () => 1,
  resolveConflict: SyncEngineDeps["resolveConflict"] = async () => "keep-local",
) {
  const local = new FakeLocal();
  const state = new FakeState();
  const engine = engineFor(server, local, state, version, { databaseVersion, resolveConflict });
  return {
    local,
    state,
    sync: () => engine.sync(),
    /** The same device after an update: same data and sync state, a new build. */
    updated: (to: string, dbVersion: (database: string) => number = () => 1) =>
      engineFor(server, local, state, to, { databaseVersion: dbVersion }),
  };
}

const NEWER_DB = () => 2;
const deckKey = (id: string) => `db:mc-decks:decks:${id}`;

describe("the writer stamp on sealed records", () => {
  test("every pushed record carries the build and content version, and a db record its database version", async () => {
    const server = new FakeServer();
    const b = device(server, NEW, NEWER_DB);
    b.local.setDeck("d1", "Deck", 5);
    b.local.values.set("ls:mc-unlocks", "{}");
    await b.local.setGame("g", 3);
    ok(await b.sync());
    const opened = new Map<string, Awaited<ReturnType<typeof openRecord>>>();
    for (const [recordKey, record] of server.records) {
      const sealed = await openRecord(creds, recordKey, record.data!);
      opened.set(sealed.key, sealed);
    }
    expect(opened.size).toBe(5);
    for (const sealed of opened.values()) expect(sealed.writer).toEqual({ app: NEW, content: `pool-${NEW}` });
    expect(opened.get(deckKey("d1"))!.db).toBe(2);
    expect(opened.get("ls:mc-unlocks")!.db).toBeUndefined();
    expect(opened.get("game:g:meta")!.db).toBeUndefined();
  });

  test("a record from a build before the stamp (no writer, no database version) is read and applied as before", async () => {
    const server = new FakeServer();
    const a = device(server, OLD);
    await server.foreignWrite(creds, deckKey("legacy"), { id: "legacy", name: "Legacy", updatedAt: "x" }, 1);
    const result = ok(await a.sync());
    expect(result.applied).toBe(1);
    expect(result.newerElsewhere).toBeUndefined();
    expect(a.local.values.has(deckKey("legacy"))).toBe(true);
  });
});

describe("a record from a newer database version", () => {
  async function newerDeckOnServer() {
    const server = new FakeServer();
    const a = device(server, OLD);
    const b = device(server, NEW, NEWER_DB);
    a.local.setDeck("d1", "One", 5);
    ok(await a.sync());
    ok(await b.sync());
    b.local.setDeck("d1", "From newer", 50);
    ok(await b.sync());
    return { server, a, b, newerVersion: await server.versionOf(creds, deckKey("d1")) };
  }

  test("is parked: not applied, not dropped, not overwritten by this build's own edit, and reported", async () => {
    const { server, a, newerVersion } = await newerDeckOnServer();
    a.local.setDeck("d1", "A edit", 40);
    const first = ok(await a.sync());
    expect(first).toMatchObject({ newerElsewhere: true, pushed: 0, applied: 0, waiting: 1 });
    expect(a.local.values.get(deckKey("d1"))).toMatchObject({ name: "A edit" });
    expect(await server.versionOf(creds, deckKey("d1"))).toBe(newerVersion);

    // It stays that way on every later run, and the note stays up.
    clock += 100;
    const again = ok(await a.sync());
    expect(again).toMatchObject({ newerElsewhere: true, pushed: 0, pulled: 0 });
    expect(await server.versionOf(creds, deckKey("d1"))).toBe(newerVersion);
  });

  test("a deck only the newer build wrote is not applied or dropped either", async () => {
    const { a, b } = await newerDeckOnServer();
    b.local.setDeck("only-newer", "Only", 60);
    ok(await b.sync());
    const result = ok(await a.sync());
    expect(result.newerElsewhere).toBe(true);
    expect(a.local.values.has(deckKey("only-newer"))).toBe(false);
    expect(a.local.values.get(deckKey("d1"))).toMatchObject({ name: "One" }); // not applied, not deleted
  });

  test("is picked up after an update, and the note goes", async () => {
    const { a } = await newerDeckOnServer();
    a.local.setDeck("d1", "A edit", 40);
    ok(await a.sync());
    const updated = a.updated(NEW, NEWER_DB);
    const result = ok(await updated.sync());
    expect(result.pulled).toBeGreaterThan(0);
    expect(result.newerElsewhere).toBeUndefined();
    // Both sides changed it: the later stamp (the newer build's 50 over this device's 40) wins.
    expect(a.local.values.get(deckKey("d1"))).toMatchObject({ name: "From newer" });
  });
});

describe("a plain record both sides changed, last written by a newer build", () => {
  test("the newer writer wins over this build's local edit, which is overwritten and never pushed", async () => {
    const server = new FakeServer();
    const a = device(server, OLD);
    const b = device(server, NEW);
    a.local.setDeck("d1", "One", 5);
    ok(await a.sync());
    ok(await b.sync());
    b.local.setDeck("d1", "From newer", 50);
    ok(await b.sync());
    const version = await server.versionOf(creds, deckKey("d1"));
    // The older build's edit is even later by stamp: without the rule it would win and be pushed.
    a.local.setDeck("d1", "A edit", 100);
    const result = ok(await a.sync());
    expect(result).toMatchObject({ applied: 1, pushed: 0, newerElsewhere: true });
    expect(a.local.values.get(deckKey("d1"))).toMatchObject({ name: "From newer" });
    expect(await server.versionOf(creds, deckKey("d1"))).toBe(version);
  });

  test("the same holds for a localStorage key", async () => {
    const server = new FakeServer();
    const a = device(server, OLD);
    const b = device(server, NEW);
    a.local.values.set("ls:mc-guide", "from-a");
    ok(await a.sync());
    ok(await b.sync());
    clock += 100;
    b.local.values.set("ls:mc-guide", "from-newer");
    ok(await b.sync());
    clock += 100;
    a.local.values.set("ls:mc-guide", "a-edit");
    const result = ok(await a.sync());
    expect(result.pushed).toBe(0);
    expect(result.newerElsewhere).toBe(true);
    expect(a.local.values.get("ls:mc-guide")).toBe("from-newer");
  });

  test("unlock picks keep their union merge even when the other writer is newer: nothing is lost", async () => {
    const prefs = (heroIds: string[]) =>
      JSON.stringify({ version: 2, unlockAll: false, heroIds, campaignIds: [], scenarioIds: [], charges: [] });
    const server = new FakeServer();
    const a = device(server, OLD);
    const b = device(server, NEW);
    a.local.values.set("ls:mc-unlocks", prefs(["h0"]));
    ok(await a.sync());
    ok(await b.sync());
    clock += 100;
    b.local.values.set("ls:mc-unlocks", prefs(["h0", "from-newer"]));
    ok(await b.sync());
    clock += 100;
    a.local.values.set("ls:mc-unlocks", prefs(["h0", "from-old"]));
    ok(await a.sync());
    const merged = JSON.parse(a.local.values.get("ls:mc-unlocks") as string) as { heroIds: string[] };
    expect([...merged.heroIds].sort()).toEqual(["from-newer", "from-old", "h0"]);
  });

  test("a record only this build changed pushes normally, and so does a tie of equal builds", async () => {
    const server = new FakeServer();
    const a = device(server, OLD);
    const b = device(server, NEW);
    const c = device(server, OLD);
    a.local.setDeck("d1", "One", 5);
    a.local.setDeck("d2", "Two", 5);
    ok(await a.sync());
    ok(await b.sync());
    ok(await c.sync());
    a.local.setDeck("d2", "Two by A", 20);
    const mine = ok(await a.sync());
    expect(mine).toMatchObject({ pushed: 1, applied: 0 });
    expect(mine.newerElsewhere).toBeUndefined();
    // Two equal builds: the ordinary last-write-wins, the later stamp pushes over the older.
    c.local.setDeck("d1", "One by C", 30);
    ok(await c.sync());
    a.local.setDeck("d1", "One by A", 90);
    const equal = ok(await a.sync());
    expect(equal.pushed).toBe(1);
    expect(a.local.values.get(deckKey("d1"))).toMatchObject({ name: "One by A" });
  });
});

describe("a game a newer build wrote", () => {
  const stamp = (local: FakeLocal, id: string, appVersion: string) => {
    const meta = local.values.get(`game:${id}:meta`) as object;
    local.values.set(`game:${id}:meta`, { ...meta, lastPlayedOn: { platform: "windows", appVersion } });
  };

  test("is applied here, but this build's own change to it is never pushed over the newer writer's records", async () => {
    const server = new FakeServer();
    const a = device(server, OLD);
    const b = device(server, NEW);
    await b.local.setGame("g", 20, { updatedAt: 2000 });
    stamp(b.local, "g", NEW);
    ok(await b.sync());

    // Taking a newer build's game down is not withholding anything: no note.
    const pulled = ok(await a.sync());
    expect(pulled.newerElsewhere).toBeUndefined();
    expect(a.local.values.get("game:g:meta")).toMatchObject({ lastPlayedOn: { appVersion: NEW } });
    expect(a.local.gameCommands("g")).toHaveLength(20);
    const before = new Map<string, number | undefined>();
    for (const part of ["baseline", "log:0"]) before.set(part, await server.versionOf(creds, `game:g:${part}`));

    // Any other change of this device's to it is withheld: it cannot have made a play on it.
    clock += 100;
    const meta = a.local.values.get("game:g:meta") as object;
    a.local.values.set("game:g:meta", { ...meta, round: 7 });
    const withheld = ok(await a.sync());
    expect(withheld).toMatchObject({ pushed: 0, newerElsewhere: true });

    // Remove (a retirement stamped as written now) changes only the status, so it does push, and only the meta.
    a.local.values.set("game:g:meta", { ...meta, status: "abandoned", updatedAt: 9000 });
    const result = ok(await a.sync());
    expect(result.pushed).toBe(1);
    for (const [part, version] of before) expect(await server.versionOf(creds, `game:g:${part}`)).toBe(version);

    // The newer build's device sees it removed, and it does not come back.
    ok(await b.sync());
    expect(b.local.values.get("game:g:meta")).toMatchObject({ status: "abandoned", lastPlayedOn: { appVersion: NEW } });
    expect(ok(await b.sync()).pushed).toBe(0);
    expect(ok(await a.sync())).toMatchObject({ pushed: 0, applied: 0 });
    expect(b.local.values.get("game:g:meta")).toMatchObject({ status: "abandoned" });
  });

  test("a game both this build and a newer build played is an ordinary conflict: the player is asked, and keep-both keeps both", async () => {
    const server = new FakeServer();
    const asked: GameConflict[] = [];
    const a = device(
      server,
      OLD,
      () => 1,
      async (conflict) => {
        asked.push(conflict);
        return "keep-both";
      },
    );
    const b = device(server, NEW);
    await a.local.setGame("g", 10, { tag: "c", updatedAt: 2000 });
    stamp(a.local, "g", OLD);
    ok(await a.sync());
    ok(await b.sync());
    // This build plays on offline while the newer build plays on elsewhere.
    clock += 100;
    await a.local.setGame("g", 20, { tag: "a", updatedAt: 3000 });
    stamp(a.local, "g", OLD);
    await b.local.setGame("g", 30, { tag: "b", updatedAt: 4000 });
    stamp(b.local, "g", NEW);
    ok(await b.sync());
    const result = ok(await a.sync());
    expect(asked).toHaveLength(1);
    expect(result.conflicts).toBe(1);
    expect(a.local.copies).toBe(1);
    expect(a.local.gameCommands("copy-1")[0]).toBe("b0"); // the newer build's play is kept as a second game
    expect(a.local.gameCommands("g")[0]).toBe("a0"); // and this device's own
  });

  test("a remote deletion of a game this device holds from a newer build is applied", async () => {
    const server = new FakeServer();
    const a = device(server, OLD);
    const b = device(server, NEW);
    await b.local.setGame("g", 10, { updatedAt: 2000 });
    stamp(b.local, "g", NEW);
    ok(await b.sync());
    ok(await a.sync());
    for (const key of [...b.local.values.keys()]) if (key.startsWith("game:g:")) b.local.values.delete(key);
    ok(await b.sync());
    ok(await a.sync());
    expect([...a.local.values.keys()].filter((key) => key.startsWith("game:g:"))).toEqual([]);
  });

  test("when the newer build plays on, its game replaces this device's copy whole, and nothing of this device's is pushed", async () => {
    const server = new FakeServer();
    const a = device(server, OLD);
    const b = device(server, NEW);
    await b.local.setGame("g", 20, { updatedAt: 2000 });
    stamp(b.local, "g", NEW);
    ok(await b.sync());
    ok(await a.sync());
    const meta = a.local.values.get("game:g:meta") as object;
    a.local.values.set("game:g:meta", { ...meta, status: "abandoned", updatedAt: 9000 });

    await b.local.setGame("g", 40, { updatedAt: 3000 });
    stamp(b.local, "g", NEW);
    ok(await b.sync());
    const result = ok(await a.sync());
    expect(result.pushed).toBe(0);
    expect(a.local.gameCommands("g")).toHaveLength(40);
    expect(a.local.values.get("game:g:meta")).toMatchObject({ status: "active", updatedAt: 3000 });
  });

  test("a change by an older writer to a game this device holds from a newer one is left on the server", async () => {
    const server = new FakeServer();
    const a = device(server, OLD);
    const b = device(server, NEW);
    const c = device(server, OLD);
    await b.local.setGame("g", 20, { updatedAt: 2000 });
    stamp(b.local, "g", NEW);
    ok(await b.sync());
    ok(await a.sync());
    ok(await c.sync());
    // C (old) retires it: its meta says abandoned but still names the newer app, so the stamp is the same.
    const meta = c.local.values.get("game:g:meta") as object;
    c.local.values.set("game:g:meta", {
      ...meta,
      status: "abandoned",
      updatedAt: 9000,
      lastPlayedOn: { appVersion: OLD },
    });
    ok(await c.sync());
    const result = ok(await a.sync());
    // A holds the newer build's game: the older writer's retirement is not applied over it.
    expect(a.local.values.get("game:g:meta")).toMatchObject({ status: "active" });
    expect(result.pushed).toBe(0);
  });
});

describe("an old build over the real local layer (IndexedDB)", () => {
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

  function idbDevice(server: FakeServer, version: string) {
    const factory = new IDBFactory();
    const games = new IdbGameStorage(factory, {
      platform: "windows",
      appVersion: version,
      contentVersion: `pool-${version}`,
    });
    const local = new IdbLocalSaveData({ indexedDB: factory, localStorage: new MapStorage(), openGameId: () => null });
    const engine = engineFor(server, local, new IdbSyncStateStore(new IDBFactory()), version);
    return { factory, games, local, engine };
  }

  const progress = (count: number, updatedAt: number) =>
    ({ round: 1, commandCount: count, updatedAt, status: "active", outcome: null }) as never;

  test("a game the newer build played arrives intact, cannot be resumed, and this build pushes nothing for it", async () => {
    const server = new FakeServer();
    const newer = idbDevice(server, NEW);
    const old = idbDevice(server, OLD);
    const config = { scenarioId: "rhino", players: [] };
    await newer.games.create(
      {
        id: "g",
        schema: 4,
        config,
        createdAt: 1,
        updatedAt: 1,
        status: "active",
        round: 1,
        commandCount: 0,
        outcome: null,
        campaignId: null,
        campaignNodeId: null,
      } as never,
      { marker: "baseline" } as never,
    );
    for (let seq = 0; seq < 3; seq++)
      await newer.games.append("g", seq, { type: "cmd", n: seq } as never, progress(seq + 1, 2000 + seq));
    ok(await newer.engine.sync());

    const result = ok(await old.engine.sync());
    expect(result).toMatchObject({ applied: 3, pushed: 0 });
    expect(result.newerElsewhere).toBeUndefined();
    const stored = await old.games.load("g");
    expect(stored!.meta.lastPlayedOn).toEqual({ platform: "windows", appVersion: NEW, contentVersion: `pool-${NEW}` });
    expect(stored!.commands).toHaveLength(3);

    // The old build's session refuses it without touching it, and the list still has it for its "update" row.
    const core = new EngineSessionCore({ storage: old.games, appVersion: OLD });
    await expect(core.resume("g")).rejects.toThrow(NEWER_SAVE_MESSAGE);
    expect((await core.activeSaves()).map((save) => save.id)).toEqual(["g"]);
    expect(await core.latestSave()).toBeNull();
    expect((await old.games.load("g"))!.meta).toMatchObject({ status: "active", commandCount: 3, updatedAt: 2002 });

    // Nothing to push afterwards either.
    clock += 100;
    expect(ok(await old.engine.sync())).toMatchObject({ pushed: 0, applied: 0 });
  });
});
