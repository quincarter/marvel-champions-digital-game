import { describe, expect, test } from "vitest";
import { deriveCredentials } from "./sync-credentials.js";
import { MAX_SYNC_ROUNDS, SyncEngine, type SyncRunResult } from "./sync-engine.js";
import { hashValue } from "./sync-local.js";
import { FakeLocal, FakeServer, FakeState } from "./sync-fakes.js";
import type { ConflictChoice, GameConflict } from "./sync-types.js";

const creds = await deriveCredentials("ABCDEFGHJKMNPQRSTUVWXYZ23");
const UNREADABLE = "TUNTMgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const otherCreds = await deriveCredentials("BCDEFGHJKMNPQRSTUVWXYZ234");

let clock = 10_000;

function device(server: FakeServer, answer: ConflictChoice = "keep-both", credentials = creds) {
  const local = new FakeLocal();
  const state = new FakeState();
  const asked: GameConflict[] = [];
  const choice = { value: answer };
  const engine = new SyncEngine({
    credentials,
    api: server.api,
    local,
    state,
    now: () => clock,
    resolveConflict: async (conflict) => {
      asked.push(conflict);
      return choice.value;
    },
  });
  return { local, state, engine, asked, choice, sync: () => engine.sync() };
}

function ok(result: SyncRunResult) {
  if (!result.ok) throw new Error(`sync failed: ${JSON.stringify(result.failure)}`);
  return result;
}

describe("plain records", () => {
  test("the first device pushes, the second pulls", async () => {
    const server = new FakeServer();
    const a = device(server);
    const b = device(server);
    a.local.setDeck("d1", "Deck", 5);
    a.local.values.set("ls:mc-unlocks", "{}");
    await a.local.setGame("g1", 70);
    const first = ok(await a.sync());
    expect(first.pushed).toBe(2 + 4); // deck, ls, meta, baseline, two chunks
    expect(a.state.metaValue.spaceId).toBe(creds.spaceId);
    expect(a.state.metaValue.lastSyncedAt).toBe(clock);

    const second = ok(await b.sync());
    expect(second.applied).toBe(6);
    expect(b.local.values).toEqual(a.local.values);
    // Nothing changed since: no writes either way.
    expect(ok(await a.sync())).toMatchObject({ pushed: 0, applied: 0 });
    expect(ok(await b.sync())).toMatchObject({ pushed: 0, applied: 0 });
  });

  test("edits travel both ways", async () => {
    const server = new FakeServer();
    const a = device(server);
    const b = device(server);
    a.local.setDeck("d1", "One", 5);
    a.local.setDeck("d2", "Two", 5);
    ok(await a.sync());
    ok(await b.sync());
    a.local.setDeck("d1", "One edited", 20);
    b.local.setDeck("d2", "Two edited", 21);
    ok(await a.sync());
    ok(await b.sync());
    ok(await a.sync());
    expect(a.local.values.get("db:mc-decks:decks:d1")).toMatchObject({ name: "One edited" });
    expect(a.local.values.get("db:mc-decks:decks:d2")).toMatchObject({ name: "Two edited" });
    expect(b.local.values).toEqual(a.local.values);
  });

  test("both changed: the later stamp wins, a tie keeps this device's", async () => {
    const server = new FakeServer();
    const a = device(server);
    const b = device(server);
    a.local.setDeck("d1", "Old", 5);
    ok(await a.sync());
    ok(await b.sync());
    a.local.setDeck("d1", "From A", 50);
    b.local.setDeck("d1", "From B", 60);
    ok(await a.sync());
    ok(await b.sync());
    ok(await a.sync());
    expect(a.local.values.get("db:mc-decks:decks:d1")).toMatchObject({ name: "From B" });

    a.local.setDeck("d1", "A tie", 70);
    b.local.setDeck("d1", "B tie", 70);
    ok(await a.sync());
    ok(await b.sync());
    expect(b.local.values.get("db:mc-decks:decks:d1")).toMatchObject({ name: "B tie" });
    ok(await a.sync());
    expect(a.local.values.get("db:mc-decks:decks:d1")).toMatchObject({ name: "B tie" });
  });

  test("a delete propagates, and an edit beats a delete", async () => {
    const server = new FakeServer();
    const a = device(server);
    const b = device(server);
    a.local.setDeck("d1", "One", 5);
    a.local.setDeck("d2", "Two", 5);
    ok(await a.sync());
    ok(await b.sync());
    a.local.values.delete("db:mc-decks:decks:d1");
    a.local.values.delete("db:mc-decks:decks:d2");
    b.local.setDeck("d2", "Two edited", 30);
    ok(await a.sync());
    ok(await b.sync());
    expect(b.local.values.has("db:mc-decks:decks:d1")).toBe(false);
    expect(b.local.values.get("db:mc-decks:decks:d2")).toMatchObject({ name: "Two edited" });
    ok(await a.sync());
    expect(a.local.values.get("db:mc-decks:decks:d2")).toMatchObject({ name: "Two edited" });
  });

  test("stamp 0 records take the time first seen, kept while the hash is unchanged", async () => {
    const server = new FakeServer();
    const a = device(server);
    a.local.values.set("ls:mc-unlocks", "{}");
    ok(await a.sync());
    expect(a.state.map.get("ls:mc-unlocks")!.stamp).toBe(clock);
    clock += 1000;
    ok(await a.sync());
    expect(a.state.map.get("ls:mc-unlocks")!.stamp).toBe(clock - 1000);
  });

  test("device-only localStorage keys and stores this build lacks are left alone", async () => {
    const server = new FakeServer();
    const a = device(server);
    a.local.values.set("ls:mc-settings", "private");
    a.local.values.set("db:mc-future:things:1", { n: 1 });
    a.local.hidden.add("db:mc-future:things:1");
    a.local.setDeck("d1", "One", 5);
    ok(await a.sync());
    expect(server.liveCount()).toBe(1);
    // An entry for a store this build doesn't read isn't a delete when the snapshot lacks it.
    await a.state.putEntries([
      { key: "db:mc-future:things:2", recordKey: "r".repeat(43), version: 9, hash: "h", stamp: 1, deleted: false },
    ]);
    const before = server.calls.batch;
    ok(await a.sync());
    expect(server.calls.batch).toBe(before);
    expect(a.state.map.get("db:mc-future:things:2")!.deleted).toBe(false);
    // Nor are remote records from such a store applied.
    await server.foreignWrite(creds, "db:mc-future:things:3", { n: 3 }, 1);
    await server.foreignWrite(creds, "ls:mc-settings", "theirs", 1);
    const b = device(server);
    ok(await b.sync());
    expect([...b.local.values.keys()]).toEqual(["db:mc-decks:decks:d1"]);
  });
});

describe("games", () => {
  async function synced(answer: ConflictChoice = "keep-both") {
    const server = new FakeServer();
    const a = device(server, answer);
    const b = device(server, answer);
    await a.local.setGame("g", 66, { tag: "x" });
    ok(await a.sync());
    ok(await b.sync());
    return { server, a, b };
  }

  test("a game played further on one device is taken by the other", async () => {
    const { a, b } = await synced();
    await a.local.setGame("g", 140, { tag: "x" });
    const pushed = ok(await a.sync());
    expect(pushed.pushed).toBe(3); // chunk 1 and 2 changed, plus meta; chunk 0 untouched
    ok(await b.sync());
    expect(b.local.gameCommands("g")).toHaveLength(140);
    expect(b.asked).toHaveLength(0);
  });

  test("an undo (truncate) propagates, chunk deletions included", async () => {
    const { a, b } = await synced();
    await a.local.setGame("g", 40, { tag: "x" });
    ok(await a.sync());
    expect(a.local.values.has("game:g:log:1")).toBe(false);
    ok(await b.sync());
    expect(b.local.gameCommands("g")).toHaveLength(40);
    expect(b.local.values.has("game:g:log:1")).toBe(false);
  });

  test("both changed, one log extends the other: the longer wins without asking", async () => {
    const { a, b } = await synced();
    await a.local.setGame("g", 100, { tag: "x" });
    await b.local.setGame("g", 80, { tag: "x" });
    ok(await a.sync());
    ok(await b.sync());
    expect(b.asked).toHaveLength(0);
    expect(b.local.gameCommands("g")).toHaveLength(100);
    // And the other way round: the device behind pushes nothing that loses the longer log.
    await b.local.setGame("g", 120, { tag: "x" });
    await a.local.setGame("g", 110, { tag: "x" });
    ok(await b.sync());
    ok(await a.sync());
    expect(a.asked).toHaveLength(0);
    expect(a.local.gameCommands("g")).toHaveLength(120);
  });

  test("a chunk changed on both sides with unrelated commands has diverged", async () => {
    const { a, b } = await synced("keep-local");
    await a.local.setGame("g", 70, { tag: "x" });
    await b.local.setGame("g", 70, { tag: "y" });
    ok(await a.sync());
    const result = ok(await b.sync());
    expect(result.conflicts).toBe(1);
    expect(b.asked[0]).toMatchObject({
      gameId: "g",
      campaign: false,
      local: { round: 8 },
      remote: { round: 8 },
    });
    expect(b.asked[0]!.label).toBe("g");
  });

  test("an undo on one side and a longer play on the other have diverged", async () => {
    const { a, b } = await synced("keep-local");
    await a.local.setGame("g", 130, { tag: "x" });
    await b.local.setGame("g", 40, { tag: "x" });
    ok(await a.sync());
    ok(await b.sync());
    expect(b.asked).toHaveLength(1);
  });

  test("keep-local pushes this device's game over the other, tombstoning chunks past its log", async () => {
    const { a, b } = await synced("keep-local");
    await a.local.setGame("g", 140, { tag: "x" });
    await b.local.setGame("g", 30, { tag: "y" });
    ok(await a.sync());
    ok(await b.sync());
    expect(b.local.gameCommands("g")).toHaveLength(30);
    ok(await a.sync());
    expect(a.asked).toHaveLength(0);
    expect(a.local.gameCommands("g")).toEqual(b.local.gameCommands("g"));
    expect(a.local.values.has("game:g:log:1")).toBe(false);
  });

  test("keep-remote takes the other device's game whole", async () => {
    const { a, b } = await synced("keep-remote");
    await a.local.setGame("g", 140, { tag: "x" });
    await b.local.setGame("g", 30, { tag: "y" });
    ok(await a.sync());
    ok(await b.sync());
    expect(b.local.gameCommands("g")).toEqual(a.local.gameCommands("g"));
    expect(b.local.values.has("game:g:log:2")).toBe(true);
    expect(ok(await b.sync())).toMatchObject({ pushed: 0 });
    expect(b.asked).toHaveLength(1);
  });

  test("keep-both copies the other device's game, then pushes this device's over it", async () => {
    const { server, a, b } = await synced("keep-both");
    await a.local.setGame("g", 70, { tag: "x" });
    await b.local.setGame("g", 70, { tag: "y" });
    ok(await a.sync());
    const result = ok(await b.sync());
    expect(b.local.copies).toBe(1);
    expect(b.local.gameCommands("copy-1")[0]).toBe("x0");
    expect(b.local.gameCommands("g")[0]).toBe("y0");
    expect(b.local.values.get("game:copy-1:meta")).toMatchObject({ id: "copy-1" });
    // The copy was uploaded in the same run (the extra round).
    expect(server.liveCount()).toBe(8); // g (meta, baseline, 2 chunks) and its copy
    expect(result.pushed).toBeGreaterThanOrEqual(6);
    ok(await a.sync());
    expect(a.local.gameCommands("g")[0]).toBe("y0");
    expect(a.local.gameCommands("copy-1")[0]).toBe("x0");
    expect(a.asked).toHaveLength(0);
  });

  test("keep-both on a campaign game is a programming error", async () => {
    const server = new FakeServer();
    const a = device(server, "keep-both");
    const b = device(server, "keep-both");
    await a.local.setGame("g", 66, { tag: "x", campaignId: "c1" });
    ok(await a.sync());
    ok(await b.sync());
    await a.local.setGame("g", 70, { tag: "x", campaignId: "c1" });
    await b.local.setGame("g", 70, { tag: "y", campaignId: "c1" });
    ok(await a.sync());
    const result = await b.sync();
    expect(b.asked[0]!.campaign).toBe(true);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure.kind).toBe("error");
    expect(b.local.copies).toBe(0);
  });

  test("the game open on this device is never written; the next sync takes it", async () => {
    const { a, b } = await synced();
    b.local.open = "g";
    const appliedBefore = b.local.applied.length;
    await a.local.setGame("g", 100, { tag: "x" });
    ok(await a.sync());
    const during = ok(await b.sync());
    expect(during.waiting).toBe(1);
    expect(b.local.gameCommands("g")).toHaveLength(66);
    expect(b.local.applied).toHaveLength(appliedBefore);
    // Its cursor did not move past the waiting records.
    expect(b.state.metaValue.cursor).toBeLessThan((await a.state.meta()).cursor);
    b.local.open = null;
    ok(await b.sync());
    expect(b.local.gameCommands("g")).toHaveLength(100);
  });

  test("local changes to the open game are still pushed", async () => {
    const { a, b } = await synced();
    b.local.open = "g";
    await b.local.setGame("g", 90, { tag: "x" });
    const result = ok(await b.sync());
    expect(result.pushed).toBeGreaterThan(0);
    ok(await a.sync());
    expect(a.local.gameCommands("g")).toHaveLength(90);
  });

  test("a deleted game propagates", async () => {
    const { a, b } = await synced();
    for (const key of [...a.local.values.keys()]) if (key.startsWith("game:g:")) a.local.values.delete(key);
    ok(await a.sync());
    ok(await b.sync());
    expect([...b.local.values.keys()].filter((k) => k.startsWith("game:"))).toEqual([]);
  });

  test("joining a space that has data: every game on both sides with different logs is asked about", async () => {
    const server = new FakeServer();
    const a = device(server);
    await a.local.setGame("g", 70, { tag: "x" });
    await a.local.setGame("only-a", 10);
    a.local.setDeck("d1", "A deck", 5);
    ok(await a.sync());

    const b = device(server, "keep-both");
    await b.local.setGame("g", 66, { tag: "x" }); // a prefix, but never synced here: still asked
    await b.local.setGame("only-b", 12);
    b.local.setDeck("d2", "B deck", 6);
    const result = ok(await b.sync());
    expect(result.conflicts).toBe(1);
    expect(b.local.values.has("game:only-a:meta")).toBe(true);
    expect(b.local.values.has("db:mc-decks:decks:d1")).toBe(true);
    ok(await a.sync());
    expect(a.local.values.has("game:only-b:meta")).toBe(true);
    expect(a.local.values.has("db:mc-decks:decks:d2")).toBe(true);
  });
});

describe("pushing", () => {
  test("batches split over the op limit", async () => {
    const server = new FakeServer();
    const a = device(server);
    for (let i = 0; i < 250; i++) a.local.setDeck(`d${i}`, "n", 5);
    const result = ok(await a.sync());
    expect(result.pushed).toBe(250);
    expect(server.batches).toEqual([100, 100, 50]);
  });

  test("batches split over the byte limit; a record over the record limit is skipped", async () => {
    const server = new FakeServer();
    const a = device(server);
    const noise = (bytes: number) => {
      const out = new Uint8Array(bytes);
      for (let at = 0; at < bytes; at += 65536) crypto.getRandomValues(out.subarray(at, Math.min(bytes, at + 65536)));
      return Buffer.from(out).toString("base64");
    };
    for (let i = 0; i < 8; i++)
      a.local.values.set(`db:mc-decks:decks:big${i}`, { id: `big${i}`, text: noise(300_000) });
    a.local.values.set("db:mc-decks:decks:huge", { id: "huge", text: noise(700_000) });
    const result = ok(await a.sync());
    expect(result.pushed).toBe(8);
    expect(result.skipped).toBe(1);
    expect(server.batches.length).toBeGreaterThanOrEqual(2);
  }, 30_000);

  test("a conflict on push pulls again and redoes the merge for those keys", async () => {
    const server = new FakeServer();
    const a = device(server);
    a.local.setDeck("d1", "One", 5);
    ok(await a.sync());
    a.local.setDeck("d1", "A edit", 40);
    a.local.setDeck("d2", "New", 40);
    let slipped = false;
    server.beforeBatch = async () => {
      if (slipped) return;
      slipped = true;
      await server.foreignWrite(creds, "db:mc-decks:decks:d1", { id: "d1", name: "B edit", updatedAt: 90 }, 90);
    };
    const calls = server.calls.batch;
    const result = ok(await a.sync());
    expect(a.local.values.get("db:mc-decks:decks:d1")).toMatchObject({ name: "B edit" });
    expect(result.pushed).toBe(1); // d2 went through the first time; d1 lost to the later stamp
    expect(server.calls.batch - calls).toBe(1);
  });

  test("a local edit that loses the race but has the later stamp is pushed in the next round", async () => {
    const server = new FakeServer();
    const a = device(server);
    a.local.setDeck("d1", "One", 5);
    ok(await a.sync());
    a.local.setDeck("d1", "A edit", 100);
    let slipped = false;
    server.beforeBatch = async () => {
      if (slipped) return;
      slipped = true;
      await server.foreignWrite(creds, "db:mc-decks:decks:d1", { id: "d1", name: "B edit", updatedAt: 50 }, 50);
    };
    const calls = server.calls.batch;
    const result = ok(await a.sync());
    expect(result.pushed).toBe(1);
    expect(server.calls.batch - calls).toBe(2);
    const b = device(server);
    ok(await b.sync());
    expect(b.local.values.get("db:mc-decks:decks:d1")).toMatchObject({ name: "A edit" });
  });

  test("conflicts that never clear stop after the round limit with retry-later", async () => {
    const server = new FakeServer();
    const a = device(server);
    a.local.setDeck("d1", "One", 5);
    ok(await a.sync());
    a.local.setDeck("d1", "A edit", 100);
    let n = 0;
    server.beforeBatch = async () => {
      n++;
      await server.foreignWrite(creds, "db:mc-decks:decks:d1", { id: "d1", name: `B${n}`, updatedAt: 50 }, 50);
    };
    const calls = server.calls.batch;
    const result = await a.sync();
    expect(result).toMatchObject({ ok: false, failure: { kind: "retry-later" } });
    expect(server.calls.batch - calls).toBe(MAX_SYNC_ROUNDS);
  });

  test("an interrupted run resumes without repeating what was saved", async () => {
    const server = new FakeServer();
    const a = device(server);
    for (let i = 0; i < 150; i++) a.local.setDeck(`d${i}`, "n", 5);
    server.failBatchNumber = 2;
    const first = await a.sync();
    expect(first).toMatchObject({ ok: false, failure: { kind: "unavailable" }, pushed: 100 });
    expect(a.state.map.size).toBe(100);
    const second = ok(await a.sync());
    expect(second.pushed).toBe(50);
    expect(server.liveCount()).toBe(150);
    const b = device(server);
    expect(ok(await b.sync()).applied).toBe(150);
  });

  test("a failed apply records nothing and keeps the cursor", async () => {
    const server = new FakeServer();
    const a = device(server);
    const b = device(server);
    a.local.setDeck("d1", "One", 5);
    ok(await a.sync());
    b.local.failApply = true;
    const result = await b.sync();
    expect(result).toMatchObject({ ok: false, failure: { kind: "error" } });
    expect(b.state.map.size).toBe(0);
    expect(b.state.metaValue.cursor).toBe(0);
    b.local.failApply = false;
    expect(ok(await b.sync()).applied).toBe(1);
  });

  test("pulls follow `more` across pages", async () => {
    const server = new FakeServer();
    server.pageSize = 7;
    const a = device(server);
    for (let i = 0; i < 20; i++) a.local.setDeck(`d${i}`, "n", 5);
    ok(await a.sync());
    const b = device(server);
    const result = ok(await b.sync());
    expect(result.pulled).toBe(20);
    expect(b.local.values.size).toBe(20);
  });

  test("a record that won't open is skipped and reported, never applied", async () => {
    const server = new FakeServer();
    const stranger = device(server, "keep-both", otherCreds);
    stranger.local.setDeck("d1", "Not ours", 5);
    ok(await stranger.sync()); // a different space entirely
    const a = device(server);
    server.records.set("x".repeat(43), { version: 99, deleted: false, data: "AAAA" });
    server.cursor = 99;
    const result = ok(await a.sync());
    expect(result.skipped).toBe(2); // the other space's record and this one
    expect(a.local.values.size).toBe(0);
  });
});

describe("spaces", () => {
  test("failures from the api come back as the result", async () => {
    const server = new FakeServer();
    const a = device(server);
    a.local.setDeck("d1", "One", 5);
    server.down = true;
    expect(await a.sync()).toMatchObject({ ok: false, failure: { kind: "unavailable" } });
    server.down = false;
    expect(ok(await a.sync()).pushed).toBe(1);
  });

  test("a different space clears the state and starts at cursor 0", async () => {
    const server = new FakeServer();
    const a = device(server);
    a.local.setDeck("d1", "One", 5);
    ok(await a.sync());
    const second = new FakeServer();
    const moved = new SyncEngine({
      credentials: otherCreds,
      api: second.api,
      local: a.local,
      state: a.state,
      now: () => clock,
      resolveConflict: async () => "keep-both",
    });
    const result = ok(await moved.sync());
    expect(result.pushed).toBe(1);
    expect(a.state.metaValue.spaceId).toBe(otherCreds.spaceId);
    expect(second.calls.createSpace).toBe(1);
    expect(a.local.values.size).toBe(1);
  });

  test("a recreated space (new epoch) resets sync state and pushes everything again", async () => {
    const server = new FakeServer();
    const a = device(server);
    a.local.setDeck("d1", "One", 5);
    await a.local.setGame("g", 10);
    ok(await a.sync());
    expect(a.state.metaValue.epoch).toBe(server.epoch);
    server.recreate();
    const result = ok(await a.sync());
    expect(result.pushed).toBe(4);
    expect(a.state.metaValue.epoch).toBe(server.epoch);
    expect(server.liveCount()).toBe(4);
    expect(a.local.values.size).toBe(4);
  });

  test("a missing space is reported as not-found", async () => {
    const server = new FakeServer();
    const a = device(server);
    ok(await a.sync());
    server.exists = false;
    expect(await a.sync()).toMatchObject({ ok: false, failure: { kind: "not-found" } });
  });
});

describe("data-loss guards", () => {
  test("a game deleted here and played on there comes back whole, and is not tombstoned later", async () => {
    const server = new FakeServer();
    const a = device(server, "keep-local");
    const b = device(server, "keep-local");
    await a.local.setGame("g", 150);
    ok(await a.sync());
    ok(await b.sync());
    for (const key of [...b.local.values.keys()]) if (key.startsWith("game:g:")) b.local.values.delete(key);
    await a.local.setGame("g", 160);
    ok(await a.sync());
    ok(await b.sync());
    ok(await b.sync());
    ok(await a.sync());
    expect(a.local.gameCommands("g")).toHaveLength(160);
    expect(b.local.gameCommands("g")).toHaveLength(160);
    expect(b.local.values.has("game:g:baseline")).toBe(true);
    expect(a.local.values.has("game:g:baseline")).toBe(true);
  });

  test("a first join takes the cloud's copy of keys with no stamp history, and pushes keys it lacks", async () => {
    const server = new FakeServer();
    const a = device(server);
    a.local.values.set("ls:mc-guide", '{"heroes":["spider-man","hulk"]}');
    clock = 10_000;
    ok(await a.sync());
    const b = device(server);
    b.local.values.set("ls:mc-guide", "{}");
    b.local.values.set("ls:mc-other", "mine");
    clock = 20_000;
    ok(await b.sync());
    clock = 30_000;
    ok(await a.sync());
    expect(a.local.values.get("ls:mc-guide")).toBe('{"heroes":["spider-man","hulk"]}');
    expect(b.local.values.get("ls:mc-guide")).toBe('{"heroes":["spider-man","hulk"]}');
    expect(a.local.values.get("ls:mc-other")).toBe("mine");
  });

  test("an unreadable record is parked: the cursor passes it, its key waits, nothing loops on retry-later", async () => {
    const server = new FakeServer();
    const a = device(server);
    const b = device(server);
    a.local.setDeck("d1", "One", 5);
    ok(await a.sync());
    ok(await b.sync());
    const recordKey = [...server.records.keys()][0]!;
    server.cursor++;
    const version = server.cursor;
    server.records.set(recordKey, { version, deleted: false, data: UNREADABLE });
    const first = ok(await b.sync());
    expect(first.skipped).toBe(1);
    expect(b.state.metaValue.cursor).toBe(version);
    b.local.setDeck("d1", "B edit", 50);
    for (let i = 0; i < 2; i++) {
      const again = ok(await b.sync()); // not retry-later
      expect(again).toMatchObject({ waiting: 1, pushed: 0, pulled: 0 });
    }
    expect(server.records.get(recordKey)!.version).toBe(version); // never overwritten
  });

  test("a delete pulled for a parked record clears the park", async () => {
    const server = new FakeServer();
    const a = device(server);
    const b = device(server);
    a.local.setDeck("d1", "One", 5);
    ok(await a.sync());
    ok(await b.sync());
    const recordKey = [...server.records.keys()][0]!;
    server.cursor++;
    server.records.set(recordKey, { version: server.cursor, deleted: false, data: UNREADABLE });
    ok(await b.sync());
    const parked = () => [...b.state.map.values()].filter((e) => e.key.startsWith("~parked:") && !e.deleted);
    expect(parked()).toHaveLength(1);
    server.cursor++;
    server.records.set(recordKey, { version: server.cursor, deleted: true });
    ok(await b.sync());
    expect(parked()).toHaveLength(0);
    expect(b.local.values.has("db:mc-decks:decks:d1")).toBe(false);
  });

  test("with an unreadable record and 300 newer ones, the next run pulls nothing new", async () => {
    const server = new FakeServer();
    const a = device(server);
    const b = device(server);
    a.local.setDeck("d0", "Zero", 5);
    ok(await a.sync());
    const recordKey = [...server.records.keys()][0]!;
    server.cursor++;
    server.records.set(recordKey, { version: server.cursor, deleted: false, data: UNREADABLE });
    for (let i = 1; i <= 300; i++) a.local.setDeck(`d${i}`, "n", 5);
    ok(await a.sync());
    const first = ok(await b.sync());
    expect(first.pulled).toBeGreaterThanOrEqual(300);
    expect(b.state.metaValue.cursor).toBe(server.cursor);
    expect(ok(await b.sync()).pulled).toBe(0);
  });

  test("records parked for a store this build lacks are fetched again once when the build changes", async () => {
    const server = new FakeServer();
    const a = device(server);
    await server.foreignWrite(creds, "db:mc-future:things:3", { id: "3" }, 1);
    for (let i = 0; i < 5; i++) await server.foreignWrite(creds, `db:mc-decks:decks:later${i}`, { id: `later${i}` }, 1);
    const knows = { future: false };
    const build = (version: string) =>
      new SyncEngine({
        credentials: creds,
        api: server.api,
        local: a.local,
        state: a.state,
        now: () => clock,
        resolveConflict: async () => "keep-both",
        clientVersion: version,
        knowsStore: (database, store) =>
          database === "mc-future" ? knows.future : database === "mc-decks" && store === "decks",
      });
    ok(await build("1").sync());
    expect(a.local.values.has("db:mc-future:things:3")).toBe(false);
    expect(ok(await build("1").sync()).pulled).toBe(0);
    knows.future = true;
    expect(ok(await build("1").sync()).pulled).toBe(0); // same build: not fetched again
    const upgraded = ok(await build("2").sync());
    expect(upgraded.pulled).toBe(6); // from the parked record on
    expect(a.local.values.has("db:mc-future:things:3")).toBe(true);
    expect(ok(await build("2").sync()).pulled).toBe(0);
  });

  test("keep-both copies once even when the push is cut short", async () => {
    const server = new FakeServer();
    const a = device(server, "keep-both");
    const b = device(server, "keep-both");
    await a.local.setGame("g", 10);
    ok(await a.sync());
    ok(await b.sync());
    await a.local.setGame("g", 12, { tag: "a" });
    ok(await a.sync());
    await b.local.setGame("g", 12, { tag: "b" });
    server.failBatchNumber = server.calls.batch + 1;
    expect((await b.sync()).ok).toBe(false);
    expect(b.local.copies).toBe(1);
    ok(await b.sync());
    expect(b.local.copies).toBe(1);
    expect(b.asked).toHaveLength(1);
    ok(await a.sync());
    expect(a.local.gameCommands("g")[0]).toBe("b0");
  });

  test("a conflict answer is asked again when the remote game changed between rounds", async () => {
    const server = new FakeServer();
    const a = device(server, "keep-local");
    const b = device(server, "keep-local");
    const c = device(server, "keep-local");
    await a.local.setGame("g", 66, { tag: "x" });
    ok(await a.sync());
    ok(await b.sync());
    ok(await c.sync());
    await a.local.setGame("g", 70, { tag: "a" });
    ok(await a.sync());
    await b.local.setGame("g", 70, { tag: "b" });
    await c.local.setGame("g", 75, { tag: "c" });
    let slipped = false;
    server.beforeBatch = async () => {
      if (slipped) return;
      slipped = true;
      await server.foreignWrite(creds, "game:g:log:0", { commands: ["z0"] }, 99_999);
      const logHash = await hashValue([
        ["game:g:log:0", await hashValue({ commands: ["z0"] })],
        ["game:g:log:1", await hashValue(b.local.values.get("game:g:log:1"))],
      ]);
      await server.foreignWrite(creds, "game:g:meta", { id: "g", updatedAt: 99_999, logHash, round: 9 }, 99_999);
    };
    ok(await b.sync());
    expect(b.asked.length).toBeGreaterThanOrEqual(2);
  });

  test("a game whose pulled chunks and meta disagree waits for the rest", async () => {
    const server = new FakeServer();
    const a = device(server);
    const b = device(server);
    await a.local.setGame("g", 10);
    ok(await a.sync());
    ok(await b.sync());
    await server.foreignWrite(creds, "game:g:meta", { id: "g", updatedAt: 99_999, logHash: "bogus" }, 99_999);
    const result = ok(await b.sync());
    expect(result.waiting).toBe(1);
    expect(b.local.gameCommands("g")).toHaveLength(10);
    expect(b.local.values.get("game:g:meta")).toMatchObject({ updatedAt: 1010 });
  });

  test("a baseline changed on both sides, or on one side while the other's log moved, has diverged", async () => {
    const server = new FakeServer();
    const a = device(server, "keep-local");
    const b = device(server, "keep-local");
    await a.local.setGame("g", 10);
    ok(await a.sync());
    ok(await b.sync());
    a.local.values.set("game:g:baseline", { gameId: "g", marker: "a" });
    b.local.values.set("game:g:baseline", { gameId: "g", marker: "b1" });
    ok(await a.sync());
    ok(await b.sync());
    expect(b.asked).toHaveLength(1);

    await a.local.setGame("g", 20, { updatedAt: 5000 });
    ok(await a.sync());
    ok(await b.sync());
    b.local.values.set("game:g:baseline", { gameId: "g", marker: "b2" });
    await a.local.setGame("g", 30, { updatedAt: 6000 });
    ok(await a.sync());
    ok(await b.sync());
    expect(b.asked.length).toBe(2);
  });
});

describe("stamps, consistency and merges", () => {
  test("a joiner's newer edit of a same-id deck is kept when its updatedAt is newer", async () => {
    const server = new FakeServer();
    const a = device(server);
    a.local.setDeck("d1", "Cloud", Date.parse("2026-10-01T00:00:00Z"));
    ok(await a.sync());
    const b = device(server);
    b.local.setDeck("d1", "Joiner newer", Date.parse("2026-10-05T00:00:00Z"));
    ok(await b.sync());
    ok(await a.sync());
    expect(b.local.values.get("db:mc-decks:decks:d1")).toMatchObject({ name: "Joiner newer" });
    expect(a.local.values.get("db:mc-decks:decks:d1")).toMatchObject({ name: "Joiner newer" });

    // And an older joiner copy loses to the cloud's.
    const c = device(server);
    c.local.setDeck("d1", "Joiner older", Date.parse("2026-09-01T00:00:00Z"));
    ok(await c.sync());
    expect(c.local.values.get("db:mc-decks:decks:d1")).toMatchObject({ name: "Joiner newer" });
  });

  test("the later deck edit wins whichever device syncs first", async () => {
    for (const order of ["a-first", "b-first"] as const) {
      const server = new FakeServer();
      const a = device(server);
      const b = device(server);
      a.local.setDeck("d1", "Base", Date.parse("2026-10-01T00:00:00Z"));
      ok(await a.sync());
      ok(await b.sync());
      a.local.setDeck("d1", "A later", Date.parse("2026-10-03T00:00:00Z"));
      b.local.setDeck("d1", "B earlier", Date.parse("2026-10-02T00:00:00Z"));
      for (const d of order === "a-first" ? [a, b, a] : [b, a, b]) ok(await d.sync());
      expect(a.local.values.get("db:mc-decks:decks:d1")).toMatchObject({ name: "A later" });
      expect(b.local.values.get("db:mc-decks:decks:d1")).toMatchObject({ name: "A later" });
    }
  });

  test("keep-remote, delete-here and keep-both wait when the server holds half a push", async () => {
    const server = new FakeServer();
    const a = device(server, "keep-remote");
    const b = device(server, "keep-remote");
    await a.local.setGame("g", 66, { tag: "x" });
    ok(await a.sync());
    ok(await b.sync());
    // Another device pushed chunk 1 longer but not its meta yet.
    await server.foreignWrite(creds, "game:g:log:1", { commands: ["x64", "x65", "f0", "f1", "f2"] }, 99_999);
    await b.local.setGame("g", 70, { tag: "y" });
    const result = ok(await b.sync());
    expect(result.waiting).toBe(1);
    expect(b.asked).toHaveLength(0);
    expect(b.local.gameCommands("g")).toHaveLength(70);
    expect(b.local.gameCommands("g")[0]).toBe("y0");
  });

  test("a game deleted here waits too when the server holds half a push", async () => {
    const server = new FakeServer();
    const a = device(server, "keep-both");
    await a.local.setGame("g", 66, { tag: "x" });
    ok(await a.sync());
    for (const key of [...a.local.values.keys()]) if (key.startsWith("game:g:")) a.local.values.delete(key);
    await server.foreignWrite(creds, "game:g:log:1", { commands: ["x64", "x65", "f0"] }, 99_999);
    const result = ok(await a.sync());
    expect(result.waiting).toBe(1);
    expect(a.local.copies).toBe(0);
    expect([...a.local.values.keys()].filter((k) => k.startsWith("game:"))).toEqual([]);
  });

  test("unlock picks merge when both devices changed them, on a join or not", async () => {
    const server = new FakeServer();
    const a = device(server);
    const prefs = (heroIds: string[], charges: { id: string; points: number }[] = []) =>
      JSON.stringify({ version: 2, unlockAll: false, heroIds, campaignIds: [], scenarioIds: [], charges });
    a.local.values.set("ls:mc-unlocks", prefs(["h1"], [{ id: "hero:h1", points: 150 }]));
    ok(await a.sync());
    const b = device(server);
    b.local.values.set("ls:mc-unlocks", prefs(["h2"], [{ id: "hero:h2", points: 150 }]));
    ok(await b.sync()); // a join with its own picks
    ok(await a.sync());
    const merged = JSON.parse(a.local.values.get("ls:mc-unlocks") as string);
    expect(merged.heroIds).toEqual(["h1", "h2"]);
    expect(merged.charges).toHaveLength(2);
    expect(b.local.values.get("ls:mc-unlocks")).toBe(a.local.values.get("ls:mc-unlocks"));

    // Not a join: both change it after syncing.
    a.local.values.set("ls:mc-unlocks", JSON.stringify({ ...merged, heroIds: ["h1", "h2", "h3"] }));
    b.local.values.set("ls:mc-unlocks", JSON.stringify({ ...merged, heroIds: ["h1", "h2", "h4"] }));
    ok(await a.sync());
    ok(await b.sync());
    ok(await a.sync());
    expect(JSON.parse(a.local.values.get("ls:mc-unlocks") as string).heroIds).toEqual(["h1", "h2", "h3", "h4"]);
    expect(b.local.values.get("ls:mc-unlocks")).toBe(a.local.values.get("ls:mc-unlocks"));
  });
});
