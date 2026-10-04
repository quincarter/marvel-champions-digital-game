/**
 * Rules-QA 2026-10-03, aae1a7ba (Q77): Kang's Wrath 4B (11013b), "each player searches the encounter deck, discard pile,
 * and set-aside area for their nemesis minion", gained a `shuffleEncounterDeck()` and had no dedicated test.
 *
 * RRG 1.8 "Search" (p. 39): "If any portion of a deck is searched, upon completion of that game step, game function, or
 * card ability, shuffle that entire deck."; "Shuffle" (p. 40): "Any time a deck is searched by a game step or card
 * ability, that deck is shuffled after the game step or card ability completes its resolution." The owner's decision
 * (2026-10-03, Q77) extends it to a search that finds nothing.
 */
import type { GameEvent, GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { endTurn, firstLegal, instancesOf, P1, playerOf, settle } from "../../testing/harness.js";
import { driveEvents } from "../../testing/staging.js";
import { wave2Scenario } from "../setup.js";
import { defeatWithAttack, runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";

const YELLOWJACKET = "12027"; // Ant-Man's nemesis minion (printed parenthetical), in his set-aside area

/** Ant-Man (Leadership) at Kang with Kang (I) and then the area's Kang (II) defeated: the next end of phase advances to 4A/4B. */
function beforeTheWrath(removeNemesis: boolean): GameState {
  let state = settle(
    runWave2(startWave2Game(wave2Scenario("kang", { players: [{ starterDeckId: "ant-leadership" }], seed: 2026 })), {
      type: "changeForm",
      playerId: P1,
      to: { heroForm: 0 },
    }),
    firstLegal,
    undefined,
    WAVE2_DEPS,
  );
  if (removeNemesis) {
    // Test-only surgery: his nemesis minion is out of the game, so the search of 4B finds nothing.
    const nemesis = instancesOf(state, YELLOWJACKET)[0]!;
    state = {
      ...state,
      removedFromGame: [...state.removedFromGame, nemesis],
      players: state.players.map((p) => ({ ...p, setAside: p.setAside.filter((id) => id !== nemesis) })),
    };
  }
  state = defeatWithAttack(state, state.villains[0]!.instanceId);
  state = settle(runWave2(state, endTurn()), firstLegal, undefined, WAVE2_DEPS);
  return defeatWithAttack(state, state.gameAreas[0]!.villainIds[0]!);
}

const encounterShuffles = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "deckShuffled" && e.zone.kind === "encounterDeck");

describe("Kang's Wrath 4B (11013b): the searched encounter deck is shuffled once the ability completes (Q77; RRG p. 39)", () => {
  it("found: Ant-Man's nemesis minion is put into play engaged, then the encounter deck is shuffled", () => {
    const start = beforeTheWrath(false);
    const { state, events } = driveEvents(WAVE2_DEPS, start, endTurn());
    expect(state.mainScheme.stageIndex).toBe(6);
    const minion = instancesOf(state, YELLOWJACKET)[0]!;
    expect(state.instances[minion]!.engagedWith).toBe(P1);
    const shuffles = events
      .map((e, i) => [e, i] as const)
      .filter(([e]) => e.type === "deckShuffled" && e.zone.kind === "encounterDeck");
    expect(shuffles).toHaveLength(1);
    const advance = events.findIndex((e) => e.type === "mainSchemeAdvanced");
    expect(advance).toBeGreaterThanOrEqual(0);
    // One of the encounter-deck shuffles comes after the nemesis minion enters play (the 4B shuffle).
    const entered = events.findIndex((e) => e.type === "cardMoved" && e.cardId === YELLOWJACKET);
    expect(entered).toBeGreaterThanOrEqual(0);
    expect(shuffles.some(([, i]) => i > entered)).toBe(true);
  });

  it("not found: the search still shuffles the encounter deck and puts nothing into play", () => {
    const start = beforeTheWrath(true);
    const { state, events } = driveEvents(WAVE2_DEPS, start, endTurn());
    expect(state.mainScheme.stageIndex).toBe(6);
    expect(playerOf(state, P1).playArea.some((id) => state.instances[id]!.cardId === YELLOWJACKET)).toBe(false);
    expect(encounterShuffles(events)).toHaveLength(1);
  });
});
