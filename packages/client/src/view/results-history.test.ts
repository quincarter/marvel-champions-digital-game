import { describe, expect, test } from "vitest";
import type { CorePlayer } from "@mc/cards";
import type { SessionConfig } from "../engine/host.js";
import { SAVE_SCHEMA, type SaveMeta, type SaveStatus } from "../engine/game-storage.js";
import { deckKeyToString, resultsHistoryOf } from "./results-history.js";

const RHINO_STANDARD: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 1,
};

const config = (overrides: Partial<SessionConfig> = {}): SessionConfig => ({ ...RHINO_STANDARD, ...overrides });

let nextId = 0;

/** A `SaveMeta` fixture. Every field a real save carries, defaulted to a finished Rhino/Standard win. */
const meta = (overrides: Partial<SaveMeta> = {}): SaveMeta => ({
  id: `g${nextId++}`,
  schema: SAVE_SCHEMA,
  config: RHINO_STANDARD,
  createdAt: 1,
  updatedAt: 1,
  status: "won",
  round: 3,
  commandCount: 10,
  outcome: { result: "win", reason: "villainDefeated" },
  campaignId: null,
  campaignNodeId: null,
  ...overrides,
});

describe("resultsHistoryOf: empty input", () => {
  test("everything is empty", () => {
    const history = resultsHistoryOf([]);
    expect(history).toEqual({ scenarios: [], decks: [], unattributedGameCount: 0, unattributedSeatCount: 0 });
  });
});

describe("resultsHistoryOf: which statuses count", () => {
  test("won and lost are results; abandoned is played but not a result; incompatible and active count for nothing", () => {
    const saves: SaveMeta[] = [
      meta({ status: "won", round: 3 }),
      meta({ status: "lost", round: 5 }),
      meta({ status: "abandoned", round: 2 }),
      meta({ status: "incompatible", round: 1 }),
      meta({ status: "active", round: 1 }),
    ];
    const history = resultsHistoryOf(saves);
    expect(history.scenarios).toHaveLength(1);
    const rhino = history.scenarios[0]!;
    expect(rhino.combined).toEqual({ wins: 1, losses: 1, gamesPlayed: 3, bestClearRounds: 3 });
  });

  test("every SaveStatus is accounted for by the module's own doc comment, not silently ignored", () => {
    const allStatuses: readonly SaveStatus[] = ["active", "won", "lost", "abandoned", "incompatible"];
    const saves = allStatuses.map((status) => meta({ status }));
    const history = resultsHistoryOf(saves);
    // won + lost + abandoned = 3 played games; active and incompatible contribute to none of it.
    expect(history.scenarios[0]!.combined.gamesPlayed).toBe(3);
  });
});

describe("resultsHistoryOf: best clear", () => {
  test("picks the fewest rounds among wins only, per difficulty, and combined across difficulties", () => {
    const saves: SaveMeta[] = [
      meta({ config: config({ difficulty: "standard" }), status: "won", round: 4 }),
      meta({ config: config({ difficulty: "standard" }), status: "won", round: 2 }),
      // A loss with a lower round than any win must never win best clear.
      meta({ config: config({ difficulty: "standard" }), status: "lost", round: 1 }),
      meta({ config: config({ difficulty: "expert" }), status: "won", round: 6 }),
    ];
    const history = resultsHistoryOf(saves);
    const rhino = history.scenarios[0]!;
    expect(rhino.byDifficulty.standard!.bestClearRounds).toBe(2);
    expect(rhino.byDifficulty.expert!.bestClearRounds).toBe(6);
    // Combined is the best across every difficulty played, not the standard-only figure.
    expect(rhino.combined.bestClearRounds).toBe(2);
  });

  test("null when there are no wins yet, even with losses on the books", () => {
    const saves: SaveMeta[] = [meta({ status: "lost", round: 1 }), meta({ status: "abandoned", round: 1 })];
    const history = resultsHistoryOf(saves);
    expect(history.scenarios[0]!.combined.bestClearRounds).toBeNull();
  });

  test("byDifficulty only lists a difficulty that was actually played", () => {
    const saves: SaveMeta[] = [meta({ config: config({ difficulty: "standard" }) })];
    const history = resultsHistoryOf(saves);
    expect(Object.keys(history.scenarios[0]!.byDifficulty)).toEqual(["standard"]);
  });
});

describe("resultsHistoryOf: deck attribution", () => {
  const STARTER_SEAT: CorePlayer = { starterDeckId: "core-spider-man-justice" };

  test("a multi-seat game credits each distinct deck once, not once per seat", () => {
    const saves: SaveMeta[] = [meta({ config: config({ players: [STARTER_SEAT, STARTER_SEAT] }), status: "won" })];
    const history = resultsHistoryOf(saves);
    expect(history.decks).toHaveLength(1);
    expect(history.decks[0]!.gamesPlayed).toBe(1);
    expect(history.decks[0]!.wins).toBe(1);
  });

  test("a precon starterDeckId and a custom deckId with the same raw string never collide", () => {
    const collidingId = "shared-id";
    const saves: SaveMeta[] = [
      meta({ config: config({ players: [{ starterDeckId: collidingId }] }), status: "won" }),
      meta({
        config: config({ players: [{ identityCardId: "01010a", deck: [], deckId: collidingId }] }),
        status: "lost",
      }),
    ];
    const history = resultsHistoryOf(saves);
    expect(history.decks).toHaveLength(2);
    const starterRecord = history.decks.find((d) => d.key.kind === "starter")!;
    const customRecord = history.decks.find((d) => d.key.kind === "custom")!;
    expect(starterRecord.wins).toBe(1);
    expect(starterRecord.losses).toBe(0);
    expect(customRecord.wins).toBe(0);
    expect(customRecord.losses).toBe(1);
    expect(deckKeyToString(starterRecord.key)).not.toBe(deckKeyToString(customRecord.key));
  });

  test("an old-shape custom seat with no deckId at all is unattributed: counted in the scenario, filed under no deck", () => {
    const oldShapeSeat = { identityCardId: "01010a", deck: [] } as unknown as CorePlayer; // pre-2026-09-17 save shape
    const saves: SaveMeta[] = [meta({ config: config({ players: [STARTER_SEAT, oldShapeSeat] }), status: "won" })];
    const history = resultsHistoryOf(saves);

    // The scenario record doesn't know or care about deck attribution.
    expect(history.scenarios[0]!.combined.gamesPlayed).toBe(1);
    expect(history.scenarios[0]!.combined.wins).toBe(1);

    // Only the attributable seat produces a deck record.
    expect(history.decks).toHaveLength(1);
    expect(history.decks[0]!.key).toEqual({ kind: "starter", starterDeckId: "core-spider-man-justice" });

    // The unattributed seat is counted honestly rather than silently dropped.
    expect(history.unattributedGameCount).toBe(1);
    expect(history.unattributedSeatCount).toBe(1);
  });

  test("an unattributed seat in a non-played (active) game isn't counted: it isn't in scope at all", () => {
    const oldShapeSeat = { identityCardId: "01010a", deck: [] } as unknown as CorePlayer;
    const saves: SaveMeta[] = [meta({ config: config({ players: [oldShapeSeat] }), status: "active" })];
    const history = resultsHistoryOf(saves);
    expect(history.unattributedGameCount).toBe(0);
    expect(history.unattributedSeatCount).toBe(0);
  });

  test("last played is the max updatedAt across a deck's played games", () => {
    const saves: SaveMeta[] = [
      meta({ config: config({ players: [STARTER_SEAT] }), status: "won", updatedAt: 100 }),
      meta({ config: config({ players: [STARTER_SEAT] }), status: "lost", updatedAt: 300 }),
      meta({ config: config({ players: [STARTER_SEAT] }), status: "abandoned", updatedAt: 200 }),
    ];
    const history = resultsHistoryOf(saves);
    expect(history.decks[0]!.lastPlayedAt).toBe(300);
    expect(history.decks[0]!.gamesPlayed).toBe(3);
  });

  test("a deck never played has no record at all (nothing to key it by)", () => {
    const history = resultsHistoryOf([]);
    expect(history.decks).toEqual([]);
  });
});

describe("resultsHistoryOf: ordering independence", () => {
  test("shuffled input produces the identical output", () => {
    const saves: SaveMeta[] = [
      meta({
        config: config({
          scenarioId: "rhino",
          difficulty: "standard",
          players: [{ starterDeckId: "core-spider-man-justice" }],
        }),
        status: "won",
        round: 3,
        updatedAt: 10,
      }),
      meta({
        config: config({
          scenarioId: "klaw",
          difficulty: "expert",
          players: [{ identityCardId: "01010a", deck: [], deckId: "local-deck-1" }],
        }),
        status: "lost",
        round: 5,
        updatedAt: 20,
      }),
      meta({
        config: config({
          scenarioId: "rhino",
          difficulty: "expert",
          players: [
            { starterDeckId: "core-spider-man-justice" },
            { identityCardId: "01010a", deck: [], deckId: "local-deck-1" },
          ],
        }),
        status: "won",
        round: 4,
        updatedAt: 30,
      }),
      meta({
        config: config({
          scenarioId: "ultron",
          difficulty: "standard",
          players: [{ identityCardId: "01010a", deck: [] } as unknown as CorePlayer],
        }),
        status: "abandoned",
        round: 1,
        updatedAt: 40,
      }),
      meta({ status: "incompatible" }),
      meta({ status: "active" }),
    ];

    const forward = resultsHistoryOf(saves);
    const shuffled = [saves[4]!, saves[2]!, saves[0]!, saves[5]!, saves[3]!, saves[1]!];
    const backward = resultsHistoryOf(shuffled);

    expect(backward).toEqual(forward);
    // Sanity: this actually exercised something (not two empty results looking equal by accident).
    expect(forward.scenarios.length).toBeGreaterThan(1);
    expect(forward.decks.length).toBeGreaterThan(1);
  });
});
