/**
 * Searching a deck shows you the cards you're searching — checked against a
 * real Black Panther game at his Foresight setup ability ("Search your deck for
 * a Black Panther upgrade and add it to your hand. Shuffle your deck.").
 */

import { beforeAll, describe, expect, test } from "vitest";
import { cardOf, locateCard, type GameState, type InstanceId, type PendingChoice } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import type { SessionConfig } from "../engine/host.js";
import { SessionStore } from "../store/session-store.js";
import { faceOf } from "./board-model.js";
import { cardName } from "./names.js";
import { faceVisible } from "./visibility.js";

const RHINO_BLACK_PANTHER: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-black-panther-protection" }],
  seed: 7,
};

let state: GameState;
let search: PendingChoice;

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(RHINO_BLACK_PANTHER);
  // Answer anything before Foresight (the mulligan) with the fewest picks.
  for (let step = 0; step < 10; step++) {
    const choice = store.state.game!.pendingChoice;
    if (!choice || choice.prompt.kind === "chooseCards") break;
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  state = store.state.game!;
  search = state.pendingChoice!;
});

const offeredIds = (): InstanceId[] =>
  search.options.flatMap((option) => (option.ref.kind === "card" ? [option.ref.instanceId] : []));

describe("searching a deck", () => {
  test("Foresight opens a choice over cards still in the deck", () => {
    expect(search?.prompt.kind).toBe("chooseCards");
    expect(offeredIds().length).toBeGreaterThan(0);
    for (const id of offeredIds()) expect(locateCard(state, id)?.kind).toBe("deck");
  });

  test("the cards being searched show their faces and names", () => {
    for (const id of offeredIds()) {
      expect(faceVisible(state, id)).toBe(true);
      expect(faceOf(state, id).kind).toBe("front");
      expect(cardName(state, id)).toBe(cardOf(state, id)!.name);
    }
  });

  test("the rest of the deck stays facedown", () => {
    const offered = new Set(offeredIds());
    const deck = state.players[0]!.deck.filter((id) => !offered.has(id));
    expect(deck.length).toBeGreaterThan(0);
    for (const id of deck) {
      expect(faceVisible(state, id)).toBe(false);
      expect(faceOf(state, id).kind).toBe("back");
    }
  });
});
