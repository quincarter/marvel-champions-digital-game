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

  test("starting a new game retires the one in progress, and Continue offers the new one", async () => {
    const storage = make();
    await storage.create(meta("old", 1), BASELINE);
    await storage.create(meta("new", 5), BASELINE);

    expect((await storage.latestActive())?.id).toBe("new");
    const statuses = Object.fromEntries((await storage.list()).map((game) => [game.id, game.status]));
    expect(statuses).toEqual({ old: "abandoned", new: "active" });
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
