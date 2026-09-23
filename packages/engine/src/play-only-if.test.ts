/**
 * docs/phase7-wave3.md §3.42: a play restriction on any condition, `constant.playOnlyIf`. Synthetic cards shaped like
 * Sliding Shot (`stld` 17005): "Play only if you control an Element Gun." and Critical Hit (`x23` 43016): "Play only if
 * there is a side scheme in the victory display." (with `ValueSpec victoryDisplayCount`).
 *
 * The card is not in play while it is checked, which is why this cannot be a `cannotPlay` rule on the card (only cards in
 * play carry rules). Sources: RRG 1.8 "Initiating Abilities" (p. 24) step 2, "Check play restrictions"; "Play
 * Restrictions and Permissions" (p. 33), "all of its play restrictions must be observed".
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { applyCommand } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustPlayer } from "./query.js";
import type { Predicate } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubSideScheme, stubUpgrade } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, P2, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const onlyIf = (id: string, condition: Predicate) => {
  const restriction = stubAbility(`${id}.constant`, {
    trigger: { kind: "constant", playOnlyIf: condition },
    effects: [],
  });
  const action = stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
  });
  return {
    card: stubEvent({ id, cost: 0, abilities: [restriction.ref, action.ref] }),
    abilities: [restriction, action],
  };
};
const SHOT = onlyIf("shot", { kind: "exists", query: { name: "gun", controller: "you" } });
const HIT = onlyIf("hit", {
  kind: "compare",
  left: { kind: "victoryDisplayCount", filter: { categories: ["sideScheme"] } },
  op: "atLeast",
  right: { kind: "const", value: 1 },
});
const GUN = stubUpgrade({ id: "gun", cost: 0 });
const PLOT = stubSideScheme({ id: "plot", startingThreat: 2 });

const deps: EngineDeps = depsOf(...SHOT.abilities, ...HIT.abilities);
const CARDS = [SHOT.card, HIT.card, GUN, PLOT];
const DECK: readonly CardId[] = [SHOT.card.id, HIT.card.id, GUN.id, GUN.id];

const start = (): GameState => gameAtFirstTurn({ cards: CARDS, deps, deck: DECK, encounter: [PLOT.id], players: 2 });

/** Plays `card` from `player`'s hand for 0, returning the engine's answer. */
function attempt(state: GameState, card: CardId, player: PlayerId = P1) {
  const given = giveCard(state, player, card);
  const result = applyCommand(
    given.state,
    { type: "playCard", playerId: player, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    deps,
  );
  return { given, result };
}

const offered = (state: GameState, id: InstanceId): boolean => {
  const legal = legalActions(state, P1, deps);
  return legal.kind === "turn" && legal.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id);
};

describe("§3.42 playOnlyIf: a play restriction on any condition", () => {
  it("cannot be played, or offered, without an Element Gun under your control", () => {
    const { given, result } = attempt(start(), SHOT.card.id);
    expect(result).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
    expect(offered(given.state, given.id)).toBe(false);
  });

  it("another player's gun is not yours", () => {
    const theirs = playerCardIntoPlay(start(), GUN.id, P2);
    const { result } = attempt(theirs.state, SHOT.card.id);
    expect(result.ok).toBe(false);
  });

  it("is played normally while you control one", () => {
    const yours = playerCardIntoPlay(start(), GUN.id, P1);
    const { given, result } = attempt(yours.state, SHOT.card.id);
    expect(result.ok).toBe(true);
    expect(offered(given.state, given.id)).toBe(true);
    const { state } = playFree(yours.state, deps, SHOT.card.id);
    expect(mustPlayer(state, P1).discard.some((id) => state.instances[id]?.cardId === SHOT.card.id)).toBe(true);
  });

  it("reads the victory display, which is out of play (victoryDisplayCount)", () => {
    expect(attempt(start(), HIT.card.id).result.ok).toBe(false);
    const plot = encounterCardInVillainArea(start(), PLOT.id);
    const displayed: GameState = {
      ...plot.state,
      villainArea: plot.state.villainArea.filter((id) => id !== plot.id),
      victoryDisplay: [...plot.state.victoryDisplay, plot.id],
    };
    expect(attempt(displayed, HIT.card.id).result.ok).toBe(true);
  });
});
