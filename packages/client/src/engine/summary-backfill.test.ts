import { describe, expect, test } from "vitest";
import type { GameState } from "@mc/engine";
import { LocalEngineHost } from "./local-host.js";
import type { SessionConfig } from "./host.js";
import { MemoryGameStorage, SAVE_SCHEMA, type SaveMeta } from "./game-storage.js";
import { backfillSummaries, filledSummary, needsBackfill } from "./summary-backfill.js";
import { SUMMARY_VERSION, type GameSummary, type SeatSummary } from "./game-summary.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 43523,
};

const WRITER = { appVersion: "1.0.0", contentVersion: "x", build: "abc" };

/** Plays a passive table to its loss through the host, so the game is stored as a live one would be. */
async function finishedGame(storage: MemoryGameStorage): Promise<SaveMeta> {
  const host = new LocalEngineHost(storage);
  let state: GameState | null = null;
  host.subscribe((update) => (state = update.state));
  await host.start(RHINO_SOLO);
  for (let step = 0; step < 1500 && !state!.outcome; step++) {
    const choice = state!.pendingChoice;
    if (choice) {
      await host.dispatch({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: choice.options.slice(0, choice.minSelections).map((option) => option.optionId),
      });
      continue;
    }
    const legal = await host.legalActions(state!.players[0]!.playerId);
    if (legal.kind !== "turn") break;
    const end = legal.legal.find((entry) => entry.action.kind === "endTurn");
    if (!end) break;
    await host.dispatch(end.example);
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  const [meta] = await storage.list();
  return meta!;
}

describe("backfillSummaries (#529)", () => {
  test("a game finished before card numbers were kept gets the same summary a live game records", async () => {
    const storage = new MemoryGameStorage();
    const live = await finishedGame(storage);
    expect(live.status).toBe("lost");
    expect(live.summary?.seats).toBeDefined();
    // As an older build left it: the summary without the per-seat card numbers or anything version 2 added.
    const {
      seats: _seats,
      villains: _villains,
      sideSchemes: _side,
      version: _version,
      encounterRevealed: _revealed,
      hurtBy: _hurtBy,
      finalBlowCardId: _finalBlowCardId,
      ...older
    } = live.summary!;
    await storage.setSummary(live.id, older, live.updatedAt, live.updatedAt);

    const written = await new LocalEngineHost(storage).backfillSummaries();
    expect(written).toBe(1);
    const [filled] = await storage.list();
    expect(filled!.summary).toEqual(live.summary);
    // Stamped one millisecond later, so sync carries it; status and device stamp are untouched.
    expect(filled!.updatedAt).toBe(live.updatedAt + 1);
    expect(filled!.status).toBe("lost");
    expect(filled!.lastPlayedOn).toEqual(live.lastPlayedOn);

    // Nothing is left to fill in.
    expect(await new LocalEngineHost(storage).backfillSummaries()).toBe(0);
  }, 120_000);
});

describe("needsBackfill", () => {
  const meta = (overrides: Partial<SaveMeta> = {}): SaveMeta => ({
    id: "g",
    schema: SAVE_SCHEMA,
    config: RHINO_SOLO,
    createdAt: 1,
    updatedAt: 2,
    status: "won",
    round: 3,
    commandCount: 10,
    outcome: { result: "win", reason: "villainDefeated" },
    campaignId: null,
    campaignNodeId: null,
    ...overrides,
  });

  test("a finished game with no card numbers needs it, whichever older build wrote it", () => {
    expect(needsBackfill(meta(), WRITER)).toBe(true);
    expect(needsBackfill(meta({ lastPlayedOn: { appVersion: "0.9.0", build: "old" } }), WRITER)).toBe(true);
  });

  test("not a game in play, a guided game, one with card numbers, another save format or a newer app's", () => {
    expect(needsBackfill(meta({ status: "active" }), WRITER)).toBe(false);
    expect(needsBackfill(meta({ guided: { kind: "tutorial" } as never }), WRITER)).toBe(false);
    expect(
      needsBackfill(
        meta({
          summary: {
            lossReason: null,
            heroesDefeated: 0,
            winners: [],
            alliesPlayed: 0,
            seats: [],
            version: SUMMARY_VERSION,
          },
        }),
        WRITER,
      ),
    ).toBe(false);
    expect(needsBackfill(meta({ schema: SAVE_SCHEMA - 1 }), WRITER)).toBe(false);
    expect(needsBackfill(meta({ lastPlayedOn: { appVersion: "9.0.0" } }), WRITER)).toBe(false);
  });
});

describe("summary version 2", () => {
  const meta = (summary: GameSummary): SaveMeta => ({
    id: "g",
    schema: SAVE_SCHEMA,
    config: RHINO_SOLO,
    createdAt: 1,
    updatedAt: 2,
    status: "won",
    round: 3,
    commandCount: 10,
    outcome: { result: "win", reason: "villainDefeated" },
    campaignId: null,
    campaignNodeId: null,
    summary,
  });
  const seat = (extra: Partial<SeatSummary> = {}): SeatSummary => ({
    identityCardId: "01001a",
    aspects: ["justice"],
    deck: ["01010"],
    plays: { "01010": 1 },
    activations: {},
    entered: {},
    damage: 4,
    thwart: 2,
    defeated: false,
    ...extra,
  });
  const v1: GameSummary = { lossReason: null, heroesDefeated: 0, winners: [], alliesPlayed: 1, seats: [seat()] };

  test("a summary with card numbers but before version 2 needs the backfill", () => {
    expect(needsBackfill(meta(v1), WRITER)).toBe(true);
    expect(needsBackfill(meta({ ...v1, version: SUMMARY_VERSION }), WRITER)).toBe(false);
  });

  test("filling a version 1 summary takes the replay's seats and new numbers, and keeps the live ones", () => {
    const replayed: GameSummary = {
      lossReason: null,
      heroesDefeated: 1,
      winners: [],
      alliesPlayed: 0,
      seats: [seat({ drawn: 12, bestTurn: { damage: 6, thwart: 3 } })],
      version: SUMMARY_VERSION,
      encounterRevealed: { "01107": 2 },
      hurtBy: { "01094": 5 },
      finalBlowCardId: "01001a",
    };
    const filled = filledSummary({ ...v1, finalBlowBy: undefined } as unknown as GameSummary, replayed);
    // The replay's seat read 5 damage where the live game recorded 4: the live number stands, the new ones are added.
    const replayedSeat = { ...replayed.seats![0]!, damage: 5 };
    expect(filledSummary(v1, { ...replayed, seats: [replayedSeat] }).seats).toEqual([{ ...replayedSeat, damage: 4 }]);
    expect(filled).toEqual({
      ...replayed,
      // What an achievement may already have read stays the live game's.
      heroesDefeated: 0,
      alliesPlayed: 1,
    });
  });

  test("a version 2 summary is replayed again, and takes the replay's version 2 numbers over its own", () => {
    const stale = { physical: 0, mental: 0, energy: 0, wild: 1 };
    const v2: GameSummary = {
      ...v1,
      version: 2,
      seats: [seat({ resources: stale, drawn: 9 })],
      hurtBy: { "01094": 4 },
    };
    expect(SUMMARY_VERSION).toBe(3);
    expect(needsBackfill(meta(v2), WRITER)).toBe(true);
    const replayed: GameSummary = {
      ...v1,
      heroesDefeated: 1,
      seats: [seat({ resources: { ...stale, wild: 2 }, drawn: 9, damage: 5 })],
      version: SUMMARY_VERSION,
      hurtBy: { "01094": 5 },
    };
    const filled = filledSummary(v2, replayed);
    expect(filled.version).toBe(SUMMARY_VERSION);
    // The Power of Aggression's doubling, counted now.
    expect(filled.seats![0]!.resources).toEqual({ ...stale, wild: 2 });
    expect(filled.hurtBy).toEqual({ "01094": 5 });
    // The numbers older summaries had stay the live game's.
    expect(filled.seats![0]!.damage).toBe(4);
    expect(filled.heroesDefeated).toBe(0);
  });
});

describe("backfillSummaries: what it never writes", () => {
  const WIN = { result: "win", reason: "villainDefeated" } as const;
  const base = (overrides: Partial<SaveMeta> = {}): SaveMeta => ({
    id: "g",
    schema: SAVE_SCHEMA,
    config: RHINO_SOLO,
    createdAt: 1,
    updatedAt: 10,
    status: "won",
    round: 5,
    commandCount: 0,
    outcome: WIN,
    campaignId: null,
    campaignNodeId: null,
    summary: { lossReason: null, heroesDefeated: 0, winners: [], alliesPlayed: 2 },
    ...overrides,
  });
  const replayed = { lossReason: null, heroesDefeated: 1, winners: [], alliesPlayed: 0, seats: [] };
  const ending = (round: number, outcome: GameState["outcome"]) => ({ round, outcome }) as unknown as GameState;

  async function run(
    meta: SaveMeta,
    replay: Parameters<typeof backfillSummaries>[2],
  ): Promise<{ written: number; row: SaveMeta }> {
    const storage = new MemoryGameStorage();
    await storage.create(meta, {} as never);
    const written = await backfillSummaries(storage, WRITER, replay, async () => undefined);
    return { written, row: (await storage.list())[0]! };
  }

  test("a replay that fails, throws or ends another way is skipped and the row is untouched", async () => {
    for (const replay of [
      async () => null,
      async () => {
        throw new Error("no longer replays");
      },
      async () => ({ state: ending(5, { result: "loss", reason: "mainSchemeCompleted" }), summary: replayed }),
      async () => ({ state: ending(4, WIN), summary: replayed }),
      async () => ({ state: ending(5, { result: "win", reason: "otherReason" } as never), summary: replayed }),
    ] as Parameters<typeof backfillSummaries>[2][]) {
      const { written, row } = await run(base(), replay);
      expect(written).toBe(0);
      expect(row.updatedAt).toBe(10);
      expect(row.summary?.seats).toBeUndefined();
    }
  });

  test("a log shorter than the save says is skipped", async () => {
    const { written } = await run(base({ commandCount: 3 }), async () => ({
      state: ending(5, WIN),
      summary: replayed,
    }));
    expect(written).toBe(0);
  });

  test("a matching replay adds only what the live summary lacked", async () => {
    const { written, row } = await run(base(), async () => ({ state: ending(5, WIN), summary: replayed }));
    expect(written).toBe(1);
    // The live numbers stand (an achievement may have read them); the card numbers come from the replay.
    expect(row.summary).toEqual({ lossReason: null, heroesDefeated: 0, winners: [], alliesPlayed: 2, seats: [] });
    expect(filledSummary(undefined, replayed)).toBe(replayed);
  });

  test("a row that changed while it replayed (sync, or play) is not written, and is tried again next time", async () => {
    const storage = new MemoryGameStorage();
    await storage.create(base(), {} as never);
    const written = await backfillSummaries(
      storage,
      WRITER,
      async () => {
        // Sync lands a newer revision of the row meanwhile.
        await storage.setStatus("g", "won", 20);
        return { state: ending(5, WIN), summary: replayed };
      },
      async () => undefined,
    );
    expect(written).toBe(0);
    const [row] = await storage.list();
    expect(row!.updatedAt).toBe(20);
    expect(row!.summary?.seats).toBeUndefined();
  });
});
