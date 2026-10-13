/**
 * The keyword-order choice, staged from a real pending choice: a two-round Rhino game from the pool's own cards, with
 * Hydra Mercenary (01101) and Hydra Bomber (01110) given Quickstrike and Teamwork (HYDRA) in the game's card pool, so
 * that the second one revealed has both keywords live with the first in play. No printed card has both yet, so the card's keywords are the
 * one patched thing; the choice itself is the engine's.
 */
import { applyCommand, type Command, type GameState, type PendingChoice } from "@mc/engine";
import { cardId, glossaryEntry, trait } from "@mc/content";
import { beforeAll, describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { choiceSourcePanelOf } from "./choice-source-panel.js";
import { firstSentence, keywordOrderTilesOf } from "./keyword-order-choice.js";

const run = (state: GameState, command: Command): GameState => {
  const result = applyCommand(state, command, POOL_DEPS);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
  return result.state;
};
const answerDefault = (state: GameState): GameState => {
  const choice = state.pendingChoice!;
  return run(state, {
    type: "resolveChoice",
    playerId: choice.playerId,
    choiceId: choice.choiceId,
    selectedOptionIds: choice.options.slice(0, choice.minSelections).map((option) => option.optionId),
  });
};

let asked: { state: GameState; choice: PendingChoice } | null = null;

beforeAll(async () => {
  const core = new EngineSessionCore();
  const started = await core.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "tigra-aggression" }],
    seed: 11,
    // Round 1: a boost card, then Hydra Mercenary revealed; round 2: a boost card, then Hydra Bomber.
    stack: { encounter: ["01098", "01101", "01104", "01110"].map(cardId) },
  });
  const base = { ...started.snapshot.state, cardPool: started.cardPool } as GameState;
  const both = [{ name: "quickstrike" }, { name: "teamwork", sharedTrait: trait("HYDRA") }];
  let state: GameState = {
    ...base,
    cardPool: {
      ...base.cardPool,
      "01101": { ...base.cardPool["01101"]!, keywords: both },
      "01110": { ...base.cardPool["01110"]!, keywords: both },
    },
  } as GameState;
  // A quickstrike attack is made on a hero, not an alter-ego: Tigra flips once the opening mulligan is answered.
  while (state.pendingChoice) state = answerDefault(state);
  state = run(state, { type: "changeForm", playerId: state.players[0]!.playerId });
  for (let guard = 0; guard < 400 && !asked; guard++) {
    if (state.pendingChoice) {
      if (state.pendingChoice.prompt.kind === "orderKeywords") asked = { state, choice: state.pendingChoice };
      else state = answerDefault(state);
      continue;
    }
    if (state.outcome || state.round > 3) break;
    // Anything the table asks of the active player: end the hero phase and let the villain phase run.
    state = run(state, { type: "endTurn", playerId: state.players[0]!.playerId } as Command);
  }
}, 120_000);

describe("the keyword-order choice tiles", () => {
  test("the staged choice is the engine's own, with both keywords as options on the one minion", () => {
    expect(asked, "the engine asked which keyword resolves first").not.toBeNull();
    expect(asked!.choice.options.map((o) => o.optionId)).toEqual(["quickstrike", "teamwork"]);
    expect(new Set(asked!.choice.options.map((o) => (o.ref.kind === "card" ? o.ref.instanceId : null))).size).toBe(1);
  });

  test("each option reads as its keyword and one line from the glossary, and the minion's face is the one source card", () => {
    const { state, choice } = asked!;
    const tiles = keywordOrderTilesOf(choice)!;
    expect([...tiles.values()].map((t) => t.name)).toEqual(["Quickstrike", "Teamwork"]);
    for (const tile of tiles.values()) {
      const entry = glossaryEntry(tile.optionId as "quickstrike" | "teamwork")!;
      expect(tile.line).toBe(firstSentence(entry.definition));
      expect(tile.line.length).toBeGreaterThan(20);
    }
    expect(tiles.get("quickstrike")!.line).toMatch(/attacks the hero it just engaged/);
    expect(tiles.get("teamwork")!.line).toMatch(/activates against that same player/);
    const panel = choiceSourcePanelOf(state, choice, choice.playerId, POOL_DEPS);
    expect(panel?.name).toBe("Hydra Bomber");
  });

  test("any other choice has no tiles", () => {
    expect(keywordOrderTilesOf({ ...asked!.choice, prompt: { kind: "orderPlayers" } as never })).toBeNull();
  });

  test("firstSentence stops at the first full stop followed by a space", () => {
    expect(firstSentence("One thing. Another thing.")).toBe("One thing.");
    expect(firstSentence("No stop")).toBe("No stop");
  });
});
