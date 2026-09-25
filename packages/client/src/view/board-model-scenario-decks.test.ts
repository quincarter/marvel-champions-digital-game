/**
 * The Infinity Stone deck (`mts` MC21 p. 16, docs/phase7-wave4.md §3.6): every card printing the Infinity Stone
 * trait, built from the encounter deck at setup with no card text asking (`GameState.scenarioDecks`, a wave 2
 * primitive, docs/phase7-wave2.md §3.3). `BoardModel` never read `scenarioDecks` at all before this, so the deck —
 * and its own discard pile, separate from the ordinary encounter discard a stone's own "Place this card in the
 * infinity stone deck discard pile" (Mind Stone, `21130`) names by name — had nowhere to show on the table.
 */
import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { boardModel } from "./board-model.js";
import { POOL_DEPS } from "../content/pool.js";

const THANOS: SessionConfig = {
  scenarioId: "thanos",
  difficulty: "standard",
  players: [{ starterDeckId: "spectrum-leadership" }],
  seed: 4,
};

const RHINO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 1,
};

async function afterSetup(config: SessionConfig, maxSteps = 10): Promise<SessionStore> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(config);
  for (let step = 0; step < maxSteps; step++) {
    const legal = store.state.legal;
    if (!legal) break;
    if (legal.actions.kind === "choice") {
      const { choice } = legal.actions;
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
      continue;
    }
    break;
  }
  return store;
}

describe("Thanos: the Infinity Stone deck", () => {
  test("the board names the deck, its card count, and an empty discard at setup", async () => {
    const store = await afterSetup(THANOS);
    const state = store.state.game!;
    expect(Object.keys(state.scenarioDecks)).toEqual(["Infinity Stone"]);

    const model = boardModel(state, store.state.perspectiveId!, POOL_DEPS);
    expect(model.scenarioDecks).toHaveLength(1);
    const [stones] = model.scenarioDecks;
    expect(stones!.name).toBe("Infinity Stone");
    expect(stones!.deckCount).toBe(state.scenarioDecks["Infinity Stone"]!.deck.length);
    expect(stones!.deckCount).toBeGreaterThan(0);
    expect(stones!.discardCount).toBe(0);
    expect(stones!.discardTopInstanceId).toBeNull();
  });

  test("a discarded stone shows as the deck's own discard top, by patching engine-owned deck state directly (the discard mechanic itself is the scripted card's own ability, not this view model's concern)", async () => {
    const store = await afterSetup(THANOS);
    const state = store.state.game!;
    const [stoneId] = state.scenarioDecks["Infinity Stone"]!.deck;
    const patched = {
      ...state,
      scenarioDecks: {
        ...state.scenarioDecks,
        "Infinity Stone": {
          ...state.scenarioDecks["Infinity Stone"]!,
          deck: state.scenarioDecks["Infinity Stone"]!.deck.slice(1),
          discard: [stoneId!],
        },
      },
    };
    const model = boardModel(patched, store.state.perspectiveId!, POOL_DEPS);
    const [stones] = model.scenarioDecks;
    expect(stones!.discardCount).toBe(1);
    expect(stones!.discardTopInstanceId).toBe(stoneId);
    expect(stones!.discardTopArt).not.toBeNull();
  });
});

describe("a scenario with no scenario deck at all", () => {
  test("model.scenarioDecks is empty", async () => {
    const store = await afterSetup(RHINO);
    const model = boardModel(store.state.game!, store.state.perspectiveId!, POOL_DEPS);
    expect(model.scenarioDecks).toEqual([]);
  });
});
