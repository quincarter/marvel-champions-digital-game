/**
 * One contract, two storages. The in-memory storage is what Vitest and the
 * in-thread host use, so it has to behave exactly like IndexedDB does — and the
 * only way to know that is to run the same cases against both.
 */

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, test } from "vitest";
import type { Command } from "@mc/engine";
import { EngineSessionCore } from "./session-core.js";
import type { SessionConfig } from "./host.js";
import { MemoryGameStorage, SAVE_SCHEMA, type GameStorage, type SaveMeta } from "./game-storage.js";
import { IdbGameStorage } from "./idb-game-storage.js";

const CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 43523,
};

/** A real replay baseline, so the round trip proves an actual engine state survives the copy. */
const BASELINE = (await new EngineSessionCore().start(CONFIG)).snapshot.state;

const meta = (id: string, updatedAt: number, overrides: Partial<SaveMeta> = {}): SaveMeta => ({
  id,
  schema: SAVE_SCHEMA,
  config: CONFIG,
  createdAt: updatedAt,
  updatedAt,
  status: "active",
  round: 1,
  commandCount: 0,
  outcome: null,
  campaignId: null,
  campaignNodeId: null,
  ...overrides,
});

const command = (n: number): Command => ({ type: "endTurn", playerId: `p${n}` }) as unknown as Command;

/**
 * A custom-deck seat carrying `CorePlayer.deckId` (docs/phase4-screen-gaps.md §2 S4): opaque
 * client-side provenance that has to survive the same copy-in/copy-out path as everything else
 * in `SaveMeta.config`, since this storage never interprets or rewrites `config`.
 */
const CONFIG_WITH_DECK_ID: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ identityCardId: "01010a", deck: [], deckId: "local-deck-42" }],
  seed: 43523,
};

describe.each<[string, () => GameStorage]>([
  ["memory", () => new MemoryGameStorage()],
  ["IndexedDB", () => new IdbGameStorage(new IDBFactory())],
])("%s game storage", (_name, make) => {
  test("a created game round-trips its config, baseline and commands in order", async () => {
    const storage = make();
    await storage.create(meta("g1", 1), BASELINE);
    await storage.append("g1", 0, command(0), {
      round: 1,
      commandCount: 1,
      updatedAt: 2,
      status: "active",
      outcome: null,
    });
    await storage.append("g1", 1, command(1), {
      round: 2,
      commandCount: 2,
      updatedAt: 3,
      status: "active",
      outcome: null,
    });

    const loaded = await storage.load("g1");
    expect(loaded).not.toBeNull();
    expect(loaded!.meta.config).toEqual(CONFIG);
    expect(loaded!.meta.round).toBe(2);
    expect(loaded!.meta.commandCount).toBe(2);
    expect(loaded!.initialState).toEqual(BASELINE);
    expect(loaded!.commands).toEqual([command(0), command(1)]);
  });

  test("a guided save round-trips its `guided` marker; a plain save has none at all (§3.12)", async () => {
    const storage = make();
    await storage.create(meta("g1", 1, { guided: { kind: "tutorial" } }), BASELINE);
    await storage.create(meta("g2", 1), BASELINE);

    const guided = await storage.load("g1");
    expect(guided!.meta.guided).toEqual({ kind: "tutorial" });

    const plain = await storage.load("g2");
    expect(plain!.meta.guided).toBeUndefined();
    expect("guided" in plain!.meta).toBe(false);
  });

  test("an out-of-order command is rejected and leaves the log untouched", async () => {
    const storage = make();
    await storage.create(meta("g1", 1), BASELINE);
    await expect(
      storage.append("g1", 1, command(1), { round: 1, commandCount: 2, updatedAt: 2, status: "active", outcome: null }),
    ).rejects.toThrow(/out of order/);
    expect((await storage.load("g1"))!.commands).toEqual([]);
  });

  test("truncate drops commands from the given count on, and updates the summary row", async () => {
    const storage = make();
    await storage.create(meta("g1", 1), BASELINE);
    await storage.append("g1", 0, command(0), {
      round: 1,
      commandCount: 1,
      updatedAt: 2,
      status: "active",
      outcome: null,
    });
    await storage.append("g1", 1, command(1), {
      round: 2,
      commandCount: 2,
      updatedAt: 3,
      status: "active",
      outcome: null,
    });
    await storage.append("g1", 2, command(2), {
      round: 2,
      commandCount: 3,
      updatedAt: 4,
      status: "active",
      outcome: null,
    });

    await storage.truncate("g1", 1, { round: 1, commandCount: 1, updatedAt: 5, status: "active", outcome: null });

    const loaded = await storage.load("g1");
    expect(loaded!.commands).toEqual([command(0)]);
    expect(loaded!.meta.commandCount).toBe(1);
    expect(loaded!.meta.round).toBe(1);
    expect(loaded!.meta.updatedAt).toBe(5);

    // A later append after a truncate lands at the truncated length, not the original one — the same "seq must be
    // the next command" check `append` already enforces, now against the shorter log.
    await storage.append("g1", 1, command(9), {
      round: 1,
      commandCount: 2,
      updatedAt: 6,
      status: "active",
      outcome: null,
    });
    expect((await storage.load("g1"))!.commands).toEqual([command(0), command(9)]);
  });

  test("starting a new game leaves the others in progress, and Continue offers the newest", async () => {
    const storage = make();
    await storage.create(meta("old", 1), BASELINE);
    await storage.create(meta("new", 5), BASELINE);
    await storage.create(meta("mid", 3), BASELINE);

    expect((await storage.latestActive())?.id).toBe("new");
    const statuses = Object.fromEntries((await storage.list()).map((game) => [game.id, game.status]));
    expect(statuses).toEqual({ old: "active", new: "active", mid: "active" });
  });

  test("a finished or incompatible game is never offered as Continue", async () => {
    const storage = make();
    await storage.create(meta("g1", 1), BASELINE);
    await storage.setStatus("g1", "incompatible");
    expect(await storage.latestActive()).toBeNull();
  });

  test("a save from an older schema is retired, not resumed (the several-villains state change)", async () => {
    const storage = make();
    // A game saved before the multi-villain state shape (docs/phase7-wave1.md §3.1–§3.2) landed. Schema 2, not
    // `SAVE_SCHEMA - 1`: schema 3 is the one schema `migrateSaveMeta` upgrades rather than retires (see the next
    // test), so this has to name a schema old enough that no migration exists for it.
    await storage.create(meta("old-shape", 1, { schema: 2 }), BASELINE);
    const core = new EngineSessionCore({ storage });

    // Never offered as Continue, and marked incompatible on the way, deliberately rather than by a failed replay.
    expect(await core.latestSave()).toBeNull();
    expect((await storage.list()).find((game) => game.id === "old-shape")?.status).toBe("incompatible");

    // Asking for it by id refuses too: no replay is attempted against a state shape this engine no longer has.
    await storage.setStatus("old-shape", "active");
    await expect(core.resume("old-shape")).rejects.toThrow(/older version/);
    expect((await storage.list()).find((game) => game.id === "old-shape")?.status).toBe("incompatible");
  });

  test("a save from schema 3 (before campaign mode, so no campaignId at all) still loads and resumes", async () => {
    const storage = make();
    // Schema 3's `SaveMeta` genuinely has no `campaignId`/`campaignNodeId` on disk — simulated here by a real
    // pre-migration shape, not just a schema number, since `SaveMeta`'s type alone can't express a value missing
    // a field TypeScript says is always there.
    const preCampaign = { ...meta("pre-campaign", 1, { schema: 3 }) } as Record<string, unknown>;
    delete preCampaign.campaignId;
    delete preCampaign.campaignNodeId;
    await storage.create(preCampaign as unknown as SaveMeta, BASELINE);

    const loaded = await storage.load("pre-campaign");
    expect(loaded?.meta.schema).toBe(SAVE_SCHEMA);
    expect(loaded?.meta.campaignId).toBeNull();
    expect(loaded?.meta.campaignNodeId).toBeNull();
    expect((await storage.list())[0]).toMatchObject({ schema: SAVE_SCHEMA, campaignId: null, campaignNodeId: null });
    expect((await storage.latestActive())?.id).toBe("pre-campaign");

    // Resumable too: `isCurrentSchema` sees schema 4 once storage has migrated it on the way out.
    const core = new EngineSessionCore({ storage });
    await expect(core.resume("pre-campaign")).resolves.toBeTruthy();
  });

  test("an older save behind the newest current one is left alone, and the current one is still offered", async () => {
    const storage = make();
    await storage.create(meta("current", 5), BASELINE);
    const core = new EngineSessionCore({ storage });
    expect((await core.latestSave())?.id).toBe("current");
  });

  test("activeSaves lists every current-schema game in progress, newest first, leaving out lessons and finished games", async () => {
    const storage = make();
    await storage.create(meta("oldest", 1), BASELINE);
    await storage.create(meta("newest", 9), BASELINE);
    await storage.create(meta("middle", 5), BASELINE);
    await storage.create(meta("won", 7, { status: "won" }), BASELINE);
    await storage.create(meta("lesson", 8, { guided: { kind: "tutorial" } }), BASELINE);
    await storage.create(meta("try-it", 6, { guided: { kind: "aspect", aspect: "justice" } }), BASELINE);
    await storage.create(meta("campaign", 4, { campaignId: "trors", campaignNodeId: "crossbones" }), BASELINE);
    await storage.create(meta("stale", 3, { schema: 2 }), BASELINE);
    const core = new EngineSessionCore({ storage });

    expect((await core.activeSaves()).map((game) => game.id)).toEqual(["newest", "middle", "campaign", "oldest"]);
    // The old-schema save is marked on the way, as Continue does, never offered; the finished one is untouched.
    const statuses = Object.fromEntries((await storage.list()).map((game) => [game.id, game.status]));
    expect(statuses).toMatchObject({ stale: "incompatible", won: "won", lesson: "active", oldest: "active" });
    // Continue still resumes the newest active save, a lesson included (its own resume question handles that).
    expect((await core.latestSave())?.id).toBe("newest");
  });

  test("a save from a NEWER build is skipped and never written to: not listed, not Continue, not resumed, not marked", async () => {
    const storage = make();
    await storage.create(meta("from-newer", 9, { schema: SAVE_SCHEMA + 1 }), BASELINE);
    await storage.create(meta("mine", 2), BASELINE);
    const core = new EngineSessionCore({ storage });

    expect((await core.activeSaves()).map((game) => game.id)).toEqual(["mine"]);
    expect((await core.latestSave())?.id).toBe("mine");
    await expect(core.resume("from-newer")).rejects.toThrow(/newer version.*Update the game/);
    const rows = Object.fromEntries((await storage.list()).map((game) => [game.id, game]));
    expect(rows["from-newer"]).toMatchObject({ status: "active", updatedAt: 9 });
  });

  test("retireSave abandons a game and stamps it as written now, so sync carries it; other games are untouched", async () => {
    const storage = make();
    await storage.create(meta("keep", 5), BASELINE);
    await storage.create(meta("drop", 6), BASELINE);
    const core = new EngineSessionCore({ storage, now: () => 9_000 });
    await core.retireSave("drop");
    const rows = Object.fromEntries((await storage.list()).map((game) => [game.id, game]));
    expect(rows.drop).toMatchObject({ status: "abandoned", updatedAt: 9_000, outcome: null });
    expect(rows.keep).toMatchObject({ status: "active", updatedAt: 5 });
    expect((await core.activeSaves()).map((game) => game.id)).toEqual(["keep"]);
    // An unknown id is a no-op, like any status change.
    await expect(core.retireSave("nobody")).resolves.toBeUndefined();
  });

  test("a status change that gives no time leaves the game's stamp alone (an incompatible mark is not a play)", async () => {
    const storage = make();
    await storage.create(meta("g", 5), BASELINE);
    await storage.setStatus("g", "incompatible");
    expect((await storage.load("g"))!.meta).toMatchObject({ status: "incompatible", updatedAt: 5 });
  });

  test("with no storage there are no games in progress", async () => {
    expect(await new EngineSessionCore().activeSaves()).toEqual([]);
  });

  test("starting a guided run retires the older active run of the same kind, and nothing else", async () => {
    const storage = make();
    let ids = 0;
    const core = () => new EngineSessionCore({ storage, newId: () => `g${++ids}`, now: () => 100 + ids });
    await core().start(CONFIG);
    await core().start({ ...CONFIG, guided: { kind: "tutorial" } });
    await core().start({ ...CONFIG, guided: { kind: "aspect", aspect: "justice" } });
    await core().start({ ...CONFIG, guided: { kind: "tutorial" } });
    const status = async () => Object.fromEntries((await storage.list()).map((game) => [game.id, game.status]));
    // g2 (tutorial) was retired by g4 (tutorial); the plain game g1 and the Try-it g3 stay.
    expect(await status()).toEqual({ g1: "active", g2: "abandoned", g3: "active", g4: "active" });

    // A plain game retires nothing, guided or not.
    await core().start(CONFIG);
    expect(await status()).toEqual({ g1: "active", g2: "abandoned", g3: "active", g4: "active", g5: "active" });
    // A second aspect Try-it replaces the first (the same guided kind).
    await core().start({ ...CONFIG, guided: { kind: "aspect", aspect: "leadership" } });
    expect((await status()).g3).toBe("abandoned");
  });

  test("games list most recently played first", async () => {
    const storage = make();
    await storage.create(meta("a", 1), BASELINE);
    await storage.create(meta("b", 2), BASELINE);
    await storage.append("a", 0, command(0), {
      round: 1,
      commandCount: 1,
      updatedAt: 9,
      status: "abandoned",
      outcome: null,
    });
    expect((await storage.list()).map((game) => game.id)).toEqual(["a", "b"]);
  });

  test("what comes back is a copy: changing it doesn't change the stored game", async () => {
    const storage = make();
    await storage.create(meta("g1", 1), BASELINE);
    const first = await storage.load("g1");
    (first!.commands as Command[]).push(command(9));
    expect((await storage.load("g1"))!.commands).toEqual([]);
  });

  test("an unknown game loads as null", async () => {
    expect(await make().load("missing")).toBeNull();
  });

  test("a seat's deckId round-trips through create, load and list, untouched", async () => {
    const storage = make();
    await storage.create(meta("g1", 1, { config: CONFIG_WITH_DECK_ID }), BASELINE);

    const loaded = await storage.load("g1");
    expect(loaded!.meta.config).toEqual(CONFIG_WITH_DECK_ID);
    expect((loaded!.meta.config.players[0] as { deckId?: string }).deckId).toBe("local-deck-42");

    const listed = await storage.list();
    expect((listed.find((game) => game.id === "g1")!.config.players[0] as { deckId?: string }).deckId).toBe(
      "local-deck-42",
    );
  });
});

describe("IndexedDB game storage stamping the platform (device sync, #276)", () => {
  const progress = { round: 1, commandCount: 1, updatedAt: 2, status: "active", outcome: null } as const;

  test("create, append and truncate stamp lastPlayedOn, a status change does not; a store without a platform leaves it alone", async () => {
    const factory = new IDBFactory();
    const windows = new IdbGameStorage(factory, { platform: "windows" });
    await windows.create(meta("g1", 1), BASELINE);
    expect((await windows.load("g1"))!.meta.lastPlayedOn).toEqual({ platform: "windows" });

    // Another device's save, opened here without a platform of its own: the stamp stays.
    const unstamped = new IdbGameStorage(factory);
    await unstamped.append("g1", 0, command(0), progress);
    expect((await unstamped.load("g1"))!.meta.lastPlayedOn).toEqual({ platform: "windows" });

    // A status change (another device's save marked incompatible, a retirement) is not playing the game.
    const android = new IdbGameStorage(factory, { platform: "android" });
    await android.setStatus("g1", "incompatible");
    expect((await android.load("g1"))!.meta.lastPlayedOn).toEqual({ platform: "windows" });
    await android.append("g1", 1, command(1), { ...progress, commandCount: 2 });
    expect((await android.load("g1"))!.meta.lastPlayedOn).toEqual({ platform: "android" });
    await android.truncate("g1", 0, { ...progress, commandCount: 0 });
    expect((await android.list())[0]!.lastPlayedOn).toEqual({ platform: "android" });
  });

  test("a game left in progress keeps its own stamp", async () => {
    const factory = new IDBFactory();
    await new IdbGameStorage(factory, { platform: "ios" }).create(meta("old", 1), BASELINE);
    await new IdbGameStorage(factory, { platform: "web" }).create(meta("new", 2), BASELINE);
    const storage = new IdbGameStorage(factory);
    expect((await storage.load("old"))!.meta).toMatchObject({ status: "active", lastPlayedOn: { platform: "ios" } });
    expect((await storage.load("new"))!.meta.lastPlayedOn).toEqual({ platform: "web" });
  });
});

test("the memory storage stamps the same way", async () => {
  const storage = new MemoryGameStorage({ platform: "linux" });
  await storage.create(meta("m", 1), BASELINE);
  expect((await storage.load("m"))!.meta.lastPlayedOn).toEqual({ platform: "linux" });
});
