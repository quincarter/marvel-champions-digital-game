import { cardsInPlay, createGame, replay, separateDeckOf } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome } from "../../../testing/driver.js";
import { P1 } from "../../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario } from "../../index.js";
import { WEATHER_DECK } from "./identity.js";

const WEATHER_CODES = ["36002", "36003", "36004", "36005"];

/**
 * A whole game with Storm's own precon (`storm-leadership`, `packages/content/src/data/storm/starterDecks.ts`: 40
 * cards plus the WEATHER deck), played by the card-name-agnostic greedy driver to a real outcome; the log replays
 * deep-equal. Only her identity ("I feel a storm coming...", Weather Control, `36001a.weather-control`) and her four
 * WEATHER supports are scripted so far; the rest of the deck plays as unscripted cards.
 */
describe("Storm (storm-leadership) vs Rhino", () => {
  it("solo, standard: plays to an outcome and replays deep-equal", () => {
    const config = wave6Scenario("rhino", { players: [{ starterDeckId: "storm-leadership" }], seed: 2026 });
    const created = createGame(config, WAVE6_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, WAVE6_DEPS);
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, WAVE6_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
    // The four WEATHER supports never leave the WEATHER deck except into play, one at a time.
    const state = result.session.state;
    const weather = Object.values(state.instances).filter((i) => WEATHER_CODES.includes(i.cardId));
    expect(weather).toHaveLength(4);
    const inPlay = weather.filter((i) => cardsInPlay(state).includes(i.instanceId));
    const inDeck = weather.filter((i) => separateDeckOf(state, P1, WEATHER_DECK).deck.includes(i.instanceId));
    // One in play while she plays; when every player is defeated the permanent supports go back to the WEATHER deck.
    expect(inPlay.length).toBeLessThanOrEqual(1);
    expect(inPlay.length + inDeck.length).toBe(4);
  }, 120_000);
});
