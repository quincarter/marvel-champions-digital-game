/**
 * Wave 11 hero packs: "a player side scheme" by card type, not controller (`TargetQuery playerSideScheme`). Strategy
 * Session 61019 ("Remove 3 threat from a player side scheme") and Stakeout 61014 ("a non-permanent encounter side
 * scheme") need it. In play in the villain's area: an encounter side scheme, a player side scheme P1 controls, and a
 * player side scheme no player controls (as the NeXt Evolution campaign's are).
 *
 * Sources: RRG 1.8 "Card Types" (p. 12: player side scheme is a player card type), "Player Side Scheme" (p. 34).
 */

import { flat, type PlayerSideSchemeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { InstanceId } from "./ids.js";
import { explainQuery, selectTargets } from "./select.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf } from "./testing/abilities.js";
import { stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1 } from "./testing/wave3.js";

const ALARM = stubSideScheme({ id: "alarm", startingThreat: 3 });
const playerSideScheme = (id: string): PlayerSideSchemeCard => ({
  ...stubSupport({ id, cost: 0 }),
  type: "player_side_scheme",
  startingThreat: flat(3),
  keywords: [],
});
const MINE = playerSideScheme("mine");
const NOBODYS = playerSideScheme("nobodys");

const deps = depsOf();
const context = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };
const PLAYER: TargetQuery = { categories: ["sideScheme"], playerSideScheme: true };
const ENCOUNTER: TargetQuery = { categories: ["sideScheme"], playerSideScheme: false };
/** The interim shape the field replaces: "a side scheme some player controls". */
const CONTROLLED: TargetQuery = { categories: ["sideScheme"], not: { controller: "encounter" } };

const idOf = (state: GameState, name: string): InstanceId =>
  Object.values(state.instances).find((instance) => (instance.cardId as string) === name)!.instanceId;
/** Surgery: a player side scheme out of P1's cards into the villain's area, with `controllerId`. */
function inVillainArea(state: GameState, name: string, controllerId: typeof P1 | null): GameState {
  const id = idOf(state, name);
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      hand: p.hand.filter((i) => i !== id),
      deck: p.deck.filter((i) => i !== id),
    })),
    villainArea: [...state.villainArea, id],
    instances: { ...state.instances, [id]: { ...state.instances[id]!, controllerId, faceup: true, threat: 3 } },
  };
}
function start(): GameState {
  const base = gameAtFirstTurn({
    cards: [ALARM, MINE, NOBODYS],
    deps,
    encounter: [ALARM.id],
    deck: [MINE.id, NOBODYS.id],
  });
  const alarm = encounterCardInVillainArea(base, ALARM.id, 3);
  return inVillainArea(inVillainArea(alarm.state, "mine", P1), "nobodys", null);
}
const names = (state: GameState, query: TargetQuery) =>
  selectTargets(state, query, context)
    .map((id) => state.instances[id]!.cardId as string)
    .sort();

describe("`TargetQuery.playerSideScheme`", () => {
  it("true: every player side scheme in play, the one no player controls included", () => {
    expect(names(start(), PLAYER)).toEqual(["mine", "nobodys"]);
  });

  it("false: the encounter side scheme only", () => {
    expect(names(start(), ENCOUNTER)).toEqual(["alarm"]);
  });

  it("control: the controller-based shapes miss the uncontrolled one, or take it for an encounter side scheme", () => {
    const state = start();
    expect(names(state, CONTROLLED)).toEqual(["mine"]);
    expect(names(state, { categories: ["sideScheme"], controller: "encounter" })).toEqual(["alarm", "nobodys"]);
  });

  it("the exclusion is `wrongCategory`, and the card is read out of play too", () => {
    const state = start();
    expect(explainQuery(state, idOf(state, "alarm"), PLAYER, context)).toBe("wrongCategory");
    expect(explainQuery(state, idOf(state, "mine"), ENCOUNTER, context)).toBe("wrongCategory");
    const inDeck = gameAtFirstTurn({ cards: [MINE], deps, deck: [MINE.id] });
    expect(explainQuery(inDeck, idOf(inDeck, "mine"), { playerSideScheme: true }, context)).toBeNull();
  });
});
