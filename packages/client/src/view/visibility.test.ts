/**
 * Searching a deck shows you the cards you're searching — checked against a
 * real Black Panther game at his Foresight setup ability ("Search your deck for
 * a Black Panther upgrade and add it to your hand. Shuffle your deck.").
 */

import { beforeAll, describe, expect, test } from "vitest";
import { cardOf, locateCard, type GameState, type InstanceId, type PendingChoice, type PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { inspectModel } from "./inspect-model.js";
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

describe("a set-aside card an open choice offers", () => {
  const pick = (): InstanceId =>
    Object.keys(state.instances).find((id) => locateCard(state, id as InstanceId)?.kind === "hand") as InstanceId;
  // Stand one hand card in the encounter set-aside, facedown, with a choice offering it.
  const aside = (offered: boolean): GameState => {
    const id = pick();
    const owner = state.players.find((player) => player.hand.includes(id))!;
    return {
      ...state,
      players: state.players.map((player) =>
        player === owner ? { ...owner, hand: owner.hand.filter((card) => card !== id) } : player,
      ),
      encounterSetAside: [...state.encounterSetAside, id],
      instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: false } },
      pendingChoice: offered
        ? { ...search, options: [{ ...search.options[0]!, ref: { kind: "card", instanceId: id } }] }
        : null,
    } as unknown as GameState;
  };

  test("is face-visible to the chooser, not otherwise", () => {
    expect(faceVisible(aside(true), pick())).toBe(true);
    expect(faceVisible(aside(false), pick())).toBe(false);
  });

  test("through the engine's rule: the chooser's sheet sees it, another named viewer does not", () => {
    const offered = aside(true);
    const chooser = offered.pendingChoice!.playerId;
    const other = "not-the-chooser" as PlayerId;
    expect(faceVisible(offered, pick(), { viewer: chooser, deps: POOL_DEPS })).toBe(true);
    expect(faceVisible(offered, pick(), { viewer: other, deps: POOL_DEPS })).toBe(false);
    expect(faceVisible(offered, pick(), { deps: POOL_DEPS })).toBe(true);
  });

  test("Inspect reads it as the chooser, whichever seat is looking", () => {
    const offered = aside(true);
    const id = pick();
    const chooser = offered.pendingChoice!.playerId;
    expect(chooser).toBeDefined();
    const seen = inspectModel(offered, id, null, "not-the-chooser" as PlayerId, POOL_DEPS);
    expect(seen.typeLine).not.toMatch(/^Facedown/);
    expect(inspectModel(aside(false), id, null, "not-the-chooser" as PlayerId, POOL_DEPS).typeLine).toMatch(
      /^Facedown/,
    );
  });
});

describe("an event being played", () => {
  test("is named, not a facedown card", () => {
    const id = Object.keys(state.instances).find(
      (card) => locateCard(state, card as InstanceId)?.kind === "hand",
    ) as InstanceId;
    const resolving = {
      ...state,
      players: state.players.map((player) =>
        player.hand.includes(id)
          ? { ...player, hand: player.hand.filter((card) => card !== id), resolving: [id] }
          : player,
      ),
    } as unknown as GameState;
    expect(locateCard(resolving, id)?.kind).toBe("resolving");
    expect(faceVisible(resolving, id)).toBe(true);
    expect(cardName(resolving, id)).not.toBe("a facedown card");
  });
});
