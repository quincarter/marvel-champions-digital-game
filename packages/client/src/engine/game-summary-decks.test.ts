/**
 * What a finished game's summary says about every seat's deck and cards (#756): each seat's deck reference, the cards it
 * drew and the cards it played, from a real two-seat game through the host and its storage, and the backfill that
 * brings an older summary up to the version that records them.
 */
import { describe, expect, test } from "vitest";
import type { GameState } from "@mc/engine";
import { CORE_POOL_VERSION, CORE_STARTER_DECKS, deckFromStarterDeck } from "@mc/content";
import { corePlayerFromDeck } from "../view/deck-seat.js";
import { LocalEngineHost } from "./local-host.js";
import type { SessionConfig } from "./host.js";
import { MemoryGameStorage, type SaveMeta } from "./game-storage.js";
import { SUMMARY_VERSION, type GameSummary } from "./game-summary.js";
import { filledSummary, needsBackfill } from "./summary-backfill.js";

const blackPanther = CORE_STARTER_DECKS.find((deck) => (deck.id as string) === "core-black-panther-protection")!;

const TWO_SEATS: SessionConfig = {
  scenarioId: "klaw",
  difficulty: "standard",
  players: [
    { starterDeckId: "core-she-hulk-aggression" },
    corePlayerFromDeck({
      ...deckFromStarterDeck(blackPanther, CORE_POOL_VERSION),
      id: "my-panther" as never,
      name: "Wakanda Wall",
    }),
  ],
  seed: 77,
};

/** Plays a table to its end through the host: every seat plays what it legally can each turn, then passes. */
async function twoSeatGame(storage: MemoryGameStorage): Promise<SaveMeta> {
  const host = new LocalEngineHost(storage);
  let state: GameState | null = null;
  host.subscribe((update) => (state = update.state));
  await host.start(TWO_SEATS);
  for (let step = 0; step < 4000 && !state!.outcome; step++) {
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
    let acted = false;
    for (const player of state!.players) {
      const legal = await host.legalActions(player.playerId);
      if (legal.kind !== "turn") continue;
      const play = legal.legal.find((entry) => entry.action.kind === "playCard");
      const next = play ?? legal.legal.find((entry) => entry.action.kind === "endTurn");
      if (!next) continue;
      await host.dispatch(next.example);
      acted = true;
      break;
    }
    if (!acted) break;
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  const [meta] = await storage.list();
  return meta!;
}

describe("a real two-seat game's summary", () => {
  test("records each seat's deck, its draws and its plays apart from the other seat's", async () => {
    const meta = await twoSeatGame(new MemoryGameStorage());
    expect(meta.summary?.version).toBe(SUMMARY_VERSION);
    const [first, second] = meta.summary!.seats!;
    expect(meta.summary!.seats).toHaveLength(2);
    expect(first).toMatchObject({ starterDeckId: "core-she-hulk-aggression" });
    expect(first!.deckId).toBeUndefined();
    expect(second).toMatchObject({ deckId: "my-panther", deckName: "Wakanda Wall" });
    expect(second!.starterDeckId).toBeUndefined();
    for (const seat of [first!, second!]) {
      // Every card a seat drew is counted once by card, and sums to its draws.
      expect(Object.values(seat.drawnCards!).reduce((sum, n) => sum + n, 0)).toBe(seat.drawn);
      expect(seat.drawn).toBeGreaterThan(0);
      // A seat can only play what its own deck brought (or its own hero's cards).
      for (const id of Object.keys(seat.plays)) expect(seat.deck).toContain(id);
    }
    expect(Object.values(first!.plays).concat(Object.values(second!.plays)).length).toBeGreaterThan(0);
  }, 240_000);
});

describe("summary version 6: the deck and the cards drawn", () => {
  const v5: GameSummary = {
    lossReason: null,
    heroesDefeated: 0,
    winners: [],
    alliesPlayed: 0,
    seats: [
      {
        identityCardId: "01010",
        aspects: ["justice"],
        deck: ["a"],
        plays: { a: 2 },
        activations: {},
        entered: {},
        damage: 5,
        thwart: 1,
        defeated: false,
        drawn: 4,
      },
    ],
    version: 5,
  };
  const meta = (summary: GameSummary): SaveMeta =>
    ({ status: "won", schema: 4, config: { players: [] }, summary, lastPlayedOn: { appVersion: "1.0.0" } }) as never;

  test("a version 5 summary is replayed again, and keeps its own numbers under the replay's deck and draws", () => {
    expect(SUMMARY_VERSION).toBe(6);
    expect(needsBackfill(meta(v5), { appVersion: "1.0.0", contentVersion: "x", build: "b" })).toBe(true);
    const replayed: GameSummary = {
      ...v5,
      version: SUMMARY_VERSION,
      seats: [
        {
          ...v5.seats![0]!,
          plays: { a: 3 },
          damage: 9,
          drawnCards: { a: 2, b: 1 },
          starterDeckId: "core-spider-man-justice",
        },
      ],
    };
    const filled = filledSummary(v5, replayed);
    expect(filled.version).toBe(SUMMARY_VERSION);
    expect(filled.seats![0]).toMatchObject({
      plays: { a: 2 },
      damage: 5,
      drawnCards: { a: 2, b: 1 },
      starterDeckId: "core-spider-man-justice",
    });
  });
});
