/**
 * "The player who removed that threat" (`TriggerEvent removeThreat.playerId`, read as `PlayerRef eventPlayer`), on
 * synthetic cards shaped like The Search for Spiral (`mojo` 39016: "Forced Response: After the last threat is removed
 * from here, the player who removed that threat reveals the top card of the show deck …" and "Hero Action: Take 2
 * damage → remove 3 threat from here").
 *
 * Sources: RRG 1.8 "Ability" (p. 4): "Any player can use such an ability on an encounter card"; "You, Your" (p. 49):
 * the player resolving an ability performs it; "Ownership and Control" (p. 31): no player controls an encounter card,
 * so the removing card's controller cannot name the player who used a scheme's own action.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { startSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEnvironment, stubEvent, stubSideScheme } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const n = (value: number) => ({ kind: "const", value }) as const;
const draws = (count: number, player: "eventPlayer" | "defeatingPlayer"): EffectSpec => ({
  kind: "draw",
  player: { kind: player },
  amount: n(count),
});
const NO_THREAT_HERE = {
  kind: "not",
  of: { kind: "compare", left: { kind: "threat", of: { kind: "self" } }, op: "atLeast", right: n(1) },
} as const;

/** A side scheme that stays in play without threat, with The Search for Spiral's two abilities (drawing 1 for the reveal). */
const LAIR_STAYS = stubAbility(
  "lair.constant",
  def({
    trigger: { kind: "constant", rules: [{ kind: "notDefeatedWithoutThreat", target: { self: true } }] },
    effects: [],
  }),
);
const LAIR_FORCED = stubAbility(
  "lair.forced-response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "removeThreat", selfIs: "target" } },
    effects: [{ kind: "if", condition: NO_THREAT_HERE, then: [draws(1, "eventPlayer")] }] as EffectSpec[],
  }),
);
const LAIR_ACTION = stubAbility("lair.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "removeThreat", target: { kind: "self" }, amount: n(3) }],
});
const LAIR = stubSideScheme({
  id: "lair",
  startingThreat: 3,
  abilities: [LAIR_STAYS.ref, LAIR_FORCED.ref, LAIR_ACTION.ref],
});

/** A plain side scheme: "Action: Remove 3 threat from here." and "When Defeated: the player who defeated this scheme draws 2 cards." */
const HIDEOUT_ACTION = stubAbility("hideout.action", LAIR_ACTION.definition);
const HIDEOUT_DEFEATED = stubAbility(
  "hideout.when-defeated",
  def({ trigger: { kind: "whenDefeated" }, effects: [draws(2, "defeatingPlayer")] }),
);
const HIDEOUT = stubSideScheme({
  id: "hideout",
  startingThreat: 3,
  abilities: [HIDEOUT_ACTION.ref, HIDEOUT_DEFEATED.ref],
});

/** An environment: "Forced Response: After threat is removed from the main scheme, remove 3 threat from each side scheme." */
const TIDE_FORCED = stubAbility(
  "tide.forced-response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "removeThreat", targetIs: { categories: ["mainScheme"] } } },
    effects: [
      { kind: "removeThreat", target: { kind: "each", query: { categories: ["sideScheme"] } }, amount: n(3) },
    ] as EffectSpec[],
  }),
);
const TIDE = stubEnvironment({ id: "tide", abilities: [TIDE_FORCED.ref] });

/** A player event: "Remove 3 threat from each side scheme." */
const RAID_ACTION = stubAbility("raid.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "removeThreat", target: { kind: "each", query: { categories: ["sideScheme"] } }, amount: n(3) }],
});
const RAID = stubEvent({ id: "raid", cost: 0, abilities: [RAID_ACTION.ref] });
const SCOUT = stubAlly({ id: "scout", cost: 0, atk: 1, thw: 3, hp: 3 });

const deps: EngineDeps = depsOf(
  LAIR_STAYS,
  LAIR_FORCED,
  LAIR_ACTION,
  HIDEOUT_ACTION,
  HIDEOUT_DEFEATED,
  TIDE_FORCED,
  RAID_ACTION,
);

/** Two players in hero form, the main scheme at 5 threat, and `scheme` in play with its 3 threat. */
function start(scheme: typeof LAIR): { readonly state: GameState; readonly scheme: InstanceId } {
  const base = gameAtFirstTurn({
    players: 2,
    cards: [LAIR, HIDEOUT, TIDE, RAID, SCOUT],
    deps,
    deck: [RAID.id, SCOUT.id],
    encounter: [LAIR.id, HIDEOUT.id, TIDE.id],
  });
  const main = base.mainScheme.instanceId;
  const heroes: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    instances: { ...base.instances, [main]: { ...mustInstance(base, main), threat: 5 } },
  };
  const placed = encounterCardInVillainArea(heroes, scheme.id, 3);
  return { state: placed.state, scheme: placed.id };
}

const run = (state: GameState, ...commands: readonly Command[]) =>
  driveSession(startSession(state), deps, commands).session.state;
const use = (player: PlayerId, card: InstanceId, ability: StubAbility): Command => ({
  type: "useAbility",
  playerId: player,
  cardInstanceId: card,
  abilityId: ability.ref.id,
  payment: [],
});
/** It is `player`'s turn: the first player's turn is ended when it is the other's. */
const asActive = (state: GameState, player: PlayerId) =>
  player === P1 ? state : run(state, { type: "endTurn", playerId: P1 });
const hands = (state: GameState) => [mustPlayer(state, P1).hand.length, mustPlayer(state, P2).hand.length] as const;
const threat = (state: GameState, id: InstanceId) => mustInstance(state, id).threat;

describe("the player who removed the threat (removeThreat.playerId, eventPlayer)", () => {
  it("a scheme's own action: the player who used it, whichever player that is", () => {
    for (const [player, drawn] of [
      [P1, [1, 0]],
      [P2, [0, 1]],
    ] as const) {
      const { state: base, scheme } = start(LAIR);
      const state = asActive(base, player);
      const before = hands(state);
      const after = run(state, use(player, scheme, LAIR_ACTION));
      expect(threat(after, scheme)).toBe(0);
      expect(hands(after)).toEqual([before[0] + drawn[0], before[1] + drawn[1]]);
    }
  });

  it("no draw while threat is left: the removal still names its player, the condition is the card's", () => {
    const { state, scheme } = start(LAIR);
    const more: GameState = {
      ...state,
      instances: { ...state.instances, [scheme]: { ...mustInstance(state, scheme), threat: 4 } },
    };
    const after = run(more, use(P1, scheme, LAIR_ACTION));
    expect(threat(after, scheme)).toBe(1);
    expect(hands(after)).toEqual(hands(more));
  });

  it("a basic thwart: the thwarting player, for the identity and for an ally alike", () => {
    const { state, scheme } = start(LAIR);
    const scout = playerCardIntoPlay(state, SCOUT.id, P1);
    const before = hands(scout.state);
    const after = run(scout.state, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: scout.id,
      schemeInstanceId: scheme,
    });
    expect(threat(after, scheme)).toBe(0);
    expect(hands(after)).toEqual([before[0] + 1, before[1]]);
  });

  it("a player card's effect: its controller, as before", () => {
    const { state, scheme } = start(LAIR);
    const given = giveCard(state, P1, RAID.id);
    const before = hands(given.state);
    const after = run(given.state, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });
    expect(threat(after, scheme)).toBe(0);
    // The event left P1's hand; the draw put one card back.
    expect(hands(after)).toEqual([before[0] - 1 + 1, before[1]]);
  });

  it("an encounter card's forced ability removes it: no player did, although a player's thwart set it off", () => {
    const { state, scheme } = start(LAIR);
    const tide = encounterCardInVillainArea(state, TIDE.id).state;
    const before = hands(tide);
    const after = run(tide, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: mustPlayer(tide, P1).identity.instanceId,
      schemeInstanceId: tide.mainScheme.instanceId,
    });
    expect(threat(after, tide.mainScheme.instanceId)).toBeLessThan(5);
    expect(threat(after, scheme)).toBe(0);
    expect(hands(after)).toEqual(before);
  });
});

describe("the player who defeated this scheme (schemeDefeated.defeatedByPlayerId)", () => {
  it("the scheme's own action defeats it: the player who used the action", () => {
    for (const [player, drawn] of [
      [P1, [2, 0]],
      [P2, [0, 2]],
    ] as const) {
      const { state: base, scheme } = start(HIDEOUT);
      const state = asActive(base, player);
      const before = hands(state);
      const after = run(state, use(player, scheme, HIDEOUT_ACTION));
      expect(after.villainArea).not.toContain(scheme);
      expect(hands(after)).toEqual([before[0] + drawn[0], before[1] + drawn[1]]);
    }
  });

  it("an encounter card's forced ability defeats it: no player did", () => {
    const { state, scheme } = start(HIDEOUT);
    const tide = encounterCardInVillainArea(state, TIDE.id).state;
    const before = hands(tide);
    const after = run(tide, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: mustPlayer(tide, P1).identity.instanceId,
      schemeInstanceId: tide.mainScheme.instanceId,
    });
    expect(after.villainArea).not.toContain(scheme);
    expect(hands(after)).toEqual(before);
  });
});
