/**
 * Issue #791: a game adjusted on one device stays adjusted whichever device's log sync keeps (`keptAdjusted`). Device A
 * undid past a reveal (a shorter log, marked); device B played on (a longer log, unmarked): B's log wins, A's mark stays.
 */
import { describe, expect, test } from "vitest";
import { deriveCredentials } from "./sync-credentials.js";
import { keptAdjusted, SyncEngine } from "./sync-engine.js";
import { FakeLocal, FakeServer, FakeState } from "./sync-fakes.js";

const creds = await deriveCredentials("ABCDEFGHJKMNPQRSTUVWXYZ23");

describe("keptAdjusted", () => {
  test("a remote meta written over a marked local one keeps the mark", () => {
    const remote = { id: "g1", commandCount: 12 };
    expect(keptAdjusted("game:g1:meta", { id: "g1", commandCount: 9, adjusted: true }, remote)).toEqual({
      id: "g1",
      commandCount: 12,
      adjusted: true,
    });
  });

  test("an unmarked local side, a marked remote, and records that are not a meta are taken as they are", () => {
    const remote = { id: "g1" };
    expect(keptAdjusted("game:g1:meta", { id: "g1" }, remote)).toBe(remote);
    const marked = { id: "g1", adjusted: true };
    expect(keptAdjusted("game:g1:meta", undefined, marked)).toBe(marked);
    expect(keptAdjusted("game:g1:log:0", { adjusted: true }, remote)).toBe(remote);
  });

  test("a campaign run keeps its mark too", () => {
    expect(keptAdjusted("db:mc-campaigns:campaigns:r1", { id: "r1", adjusted: true }, { id: "r1" })).toEqual({
      id: "r1",
      adjusted: true,
    });
    expect(keptAdjusted("db:mc-decks:decks:d1", { adjusted: true }, { id: "d1" })).toEqual({ id: "d1" });
  });
});

describe("two devices: an Undo past a reveal on one, a longer game on the other", () => {
  const device = (server: FakeServer, answer: "keep-local" | "keep-both" = "keep-local") => {
    const local = new FakeLocal();
    const engine = new SyncEngine({
      credentials: creds,
      api: server.api,
      local,
      state: new FakeState(),
      now: () => 10_000,
      resolveConflict: async () => answer,
    });
    return { local, sync: async () => expect((await engine.sync()).ok).toBe(true) };
  };
  const markAdjusted = (local: FakeLocal, id: string) => {
    const meta = local.values.get(`game:${id}:meta`) as object;
    local.values.set(`game:${id}:meta`, { ...meta, adjusted: true });
  };
  const adjusted = (local: FakeLocal, id: string) =>
    (local.values.get(`game:${id}:meta`) as { adjusted?: unknown } | undefined)?.adjusted === true;

  // The two logs have diverged (an undo shortened one), so the player is asked which to keep.
  test("keeping the unmarked device's game over the marked one keeps the mark on both devices", async () => {
    const server = new FakeServer();
    const a = device(server);
    const b = device(server);
    await a.local.setGame("g", 66, { tag: "x" });
    await a.sync();
    await b.sync();
    // A undoes past a reveal (a shorter log, marked); B plays on (a longer log, unmarked).
    await a.local.setGame("g", 60, { tag: "x" });
    markAdjusted(a.local, "g");
    await b.local.setGame("g", 100, { tag: "x" });
    await a.sync();
    await b.sync();
    expect(b.local.gameCommands("g")).toHaveLength(100);
    expect(adjusted(b.local, "g")).toBe(true);
    await a.sync();
    expect(a.local.gameCommands("g")).toHaveLength(100);
    expect(adjusted(a.local, "g")).toBe(true);
  });

  test("keeping both: the marked game comes over as its own copy, still marked", async () => {
    const server = new FakeServer();
    const a = device(server, "keep-both");
    const b = device(server, "keep-both");
    await a.local.setGame("g", 66, { tag: "x" });
    await a.sync();
    await b.sync();
    await a.local.setGame("g", 60, { tag: "x" });
    markAdjusted(a.local, "g");
    await b.local.setGame("g", 100, { tag: "x" });
    await a.sync();
    await b.sync();
    // B's own game never had the undo; the copy of A's game keeps its mark.
    expect(adjusted(b.local, "copy-1")).toBe(true);
  });

  test("a marked campaign run stays marked when an unmarked later write of it wins", async () => {
    const server = new FakeServer();
    const a = device(server);
    const b = device(server);
    const key = "db:mc-campaigns:campaigns:r1";
    a.local.values.set(key, { id: "r1", updatedAt: 5, status: "active" });
    await a.sync();
    await b.sync();
    a.local.values.set(key, { id: "r1", updatedAt: 50, status: "active", adjusted: true });
    b.local.values.set(key, { id: "r1", updatedAt: 60, status: "won" });
    await a.sync();
    await b.sync();
    expect(b.local.values.get(key)).toMatchObject({ status: "won", adjusted: true });
    await a.sync();
    expect(a.local.values.get(key)).toMatchObject({ status: "won", adjusted: true });
    // And the other way round: the marked side's record is the later one, the unmarked side keeps the mark.
    a.local.values.set(key, { id: "r1", updatedAt: 80, status: "won", adjusted: true });
    b.local.values.set(key, { id: "r1", updatedAt: 70, status: "won" });
    await b.sync();
    await a.sync();
    await b.sync();
    expect(b.local.values.get(key)).toMatchObject({ adjusted: true });
  });
});
