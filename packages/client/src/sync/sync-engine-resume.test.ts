import { describe, expect, test } from "vitest";
import { deriveCredentials } from "./sync-credentials.js";
import { SyncEngine, type SyncRunResult } from "./sync-engine.js";
import { FakeLocal, FakeServer, FakeState } from "./sync-fakes.js";
import type { ConflictChoice, GameConflict } from "./sync-types.js";

/**
 * Continue vs a running sync (device sync, #276): a game opened while its conflict prompt was up is never written under
 * its session, an answer is never remembered past new turns, and "later" leaves everything for the next sync.
 */

const creds = await deriveCredentials("ABCDEFGHJKMNPQRSTUVWXYZ23");

function ok(result: SyncRunResult) {
  if (!result.ok) throw new Error(`sync failed: ${JSON.stringify(result.failure)}`);
  return result;
}

function device(
  server: FakeServer,
  answer: (c: GameConflict, d: ReturnType<typeof device>) => Promise<ConflictChoice>,
) {
  const local = new FakeLocal();
  const state = new FakeState();
  const asked: GameConflict[] = [];
  const d: {
    local: FakeLocal;
    state: FakeState;
    asked: GameConflict[];
    engine: SyncEngine;
    sync: () => Promise<SyncRunResult>;
  } = {
    local,
    state,
    asked,
    engine: new SyncEngine({
      credentials: creds,
      api: server.api,
      local,
      state,
      now: () => 10_000,
      resolveConflict: async (conflict) => {
        asked.push(conflict);
        return answer(conflict, d);
      },
    }),
    sync: () => d.engine.sync(),
  };
  return d;
}

async function diverged(answer: Parameters<typeof device>[1]) {
  const server = new FakeServer();
  const a = device(server, async () => "keep-local");
  const b = device(server, answer);
  await a.local.setGame("g", 10, { tag: "x" });
  ok(await a.sync());
  ok(await b.sync());
  await a.local.setGame("g", 20, { tag: "x" });
  await b.local.setGame("g", 15, { tag: "y" });
  ok(await a.sync());
  return { server, a, b };
}

describe("a game opened while its conflict prompt is up", () => {
  test('"keep the other device" never writes the open game and never throws', async () => {
    const { b } = await diverged(async (_c, d) => {
      // Continue went on while the player decided: the game is on the table now.
      d.local.open = "g";
      return "keep-remote";
    });
    const before = b.local.gameCommands("g");
    const result = ok(await b.sync());
    expect(result.waiting).toBeGreaterThan(0);
    expect(b.local.gameCommands("g")).toEqual(before);
  });

  test("the answer is not remembered past new local turns: it asks again", async () => {
    const { b } = await diverged(async (_c, d) => {
      d.local.open = "g";
      return "keep-remote";
    });
    ok(await b.sync());
    expect(b.asked).toHaveLength(1);
    // The game is closed again, after more turns here.
    b.local.open = null;
    await b.local.setGame("g", 25, { tag: "y" });
    b.local.open = null;
    const again = ok(await b.sync());
    expect(b.asked).toHaveLength(2);
    expect(again.waiting).toBeGreaterThanOrEqual(0);
  });

  test("a choice made for a game stays made while neither side moves", async () => {
    const { b } = await diverged(async () => "keep-remote");
    ok(await b.sync());
    ok(await b.sync());
    expect(b.asked).toHaveLength(1);
  });

  test("a game opened between the plan and the write is not written", async () => {
    const server = new FakeServer();
    const a = device(server, async () => "keep-local");
    const b = device(server, async () => "keep-local");
    await a.local.setGame("g", 10, { tag: "x" });
    ok(await a.sync());
    ok(await b.sync());
    await a.local.setGame("g", 30, { tag: "x" });
    ok(await a.sync());
    // B's snapshot sees no open game, then Continue opens it just before B's apply.
    const original = b.local.snapshot.bind(b.local);
    b.local.snapshot = async () => {
      const records = await original();
      b.local.open = "g";
      return records;
    };
    const before = b.local.gameCommands("g");
    ok(await b.sync());
    expect(b.local.gameCommands("g")).toEqual(before);
  });
});

describe("later", () => {
  test("writes nothing, remembers nothing, and the next sync asks again", async () => {
    let answer: ConflictChoice = "later";
    const { a, b } = await diverged(async () => answer);
    const before = b.local.gameCommands("g");
    const first = ok(await b.sync());
    expect(first.waiting).toBeGreaterThan(0);
    expect(b.local.gameCommands("g")).toEqual(before);
    expect(b.asked).toHaveLength(1);
    answer = "keep-remote";
    ok(await b.sync());
    expect(b.asked).toHaveLength(2);
    expect(b.local.gameCommands("g")).toEqual(a.local.gameCommands("g"));
  });
});
