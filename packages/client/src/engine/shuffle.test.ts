/**
 * Every standalone battle shuffles every deck from its seed (RRG 1.8 Appendix II, p. 51): a new seed is a new deal
 * for each scenario the pool ships, and the same seed is the same deal, which is what "Same seed, same hands" and
 * replays rely on. The campaign's own per-attempt seeds are covered in `campaign/campaign-service.test.ts`.
 */
import { describe, expect, test } from "vitest";
import type { GameState } from "@mc/engine";
import { POOL_SCENARIOS, POOL_VERSION } from "../content/pool.js";
import { corePlayerFromDeck } from "../view/deck-seat.js";
import { preconDecks } from "../view/deck-list-model.js";
import { MemoryGameStorage } from "./game-storage.js";
import { EngineSessionCore } from "./session-core.js";

const player = corePlayerFromDeck(preconDecks(POOL_VERSION)[0]!);

async function dealFor(scenarioId: string, seed: number): Promise<string> {
  const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
  const { state } = (
    await core.start({
      scenarioId,
      difficulty: "standard",
      players: [player],
      seed,
    })
  ).snapshot;
  return orderOf(state);
}

const orderOf = (state: Pick<GameState, "players" | "encounterDecks">): string =>
  JSON.stringify({
    players: state.players.map((player) => [player.hand, player.deck]),
    encounter: Object.values(state.encounterDecks).map((deck) => deck.deck),
  });

describe("standalone battles shuffle every deck", () => {
  test.each(POOL_SCENARIOS.map((scenario) => scenario.id as string))("%s", async (scenarioId) => {
    const first = await dealFor(scenarioId, 101);
    expect(await dealFor(scenarioId, 202)).not.toBe(first);
    expect(await dealFor(scenarioId, 101)).toBe(first);
  });
});
