/**
 * A minion whose hit points are printed with the per player icon (`MinionCard.hpPerPlayer`): "The [per player] icon next
 * to a value multiplies that value by the number of players who **started** the scenario. If a player is eliminated,
 * this value does not change." (RRG 1.8 "Per Player Icon", p. 32). The icon "is not considered a modifier and is applied
 * before any modifiers are applied" (RRG 1.8 "Modifiers", p. 29). Only damage is stored, so the dial follows the product.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { maxHitPoints, mustInstance, printedHpNumeral, printedProfile, remainingHitPoints } from "./query.js";
import { cardsInPlay, selectTargets } from "./select.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAttachment, stubEvent, stubMinion, stubUpgrade } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const constant = (value: number): ValueSpec => ({ kind: "const", value });
const eachMinion: TargetRef = { kind: "each", query: { categories: ["minion"] } };
const eachTracker: TargetRef = { kind: "each", query: { categories: ["upgrade"], name: "tracker" } };

/** Printed "5 [per player]". */
const WARDEN = stubMinion({ id: "warden", atk: 1, sch: 1, hp: 5, hpPerPlayer: true });
/** Printed a flat 5. */
const GRUNT = stubMinion({ id: "grunt", atk: 1, sch: 1, hp: 5 });
const TRACKER = stubUpgrade({ id: "tracker", cost: 0 });
/** "Attached minion gets +2 hit points." */
const BIGGER = stubAbility("armor.constant", {
  trigger: { kind: "constant", modifiers: [{ stat: "hp", amount: 2, target: { categories: ["minion"] } }] },
  effects: [],
} as AbilityDefinition);
const ARMOR = stubAttachment({ id: "armor", abilities: [BIGGER.ref] });

const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const NINE = action("nine", [{ kind: "dealDamage", target: eachMinion, amount: constant(9) }]);
const ONE = action("one", [{ kind: "dealDamage", target: eachMinion, amount: constant(1) }]);
const MEASURE = action("measure", [
  { kind: "addCounters", target: eachTracker, counterType: "printed", amount: { kind: "printedHp", of: eachMinion } },
  {
    kind: "addCounters",
    target: eachTracker,
    counterType: "numeral",
    amount: { kind: "printedHp", of: eachMinion, numeral: true },
  },
]);
const ACTIONS = [NINE, ONE, MEASURE];
const deps: EngineDeps = depsOf(...ACTIONS.map((a) => a.ability));
const armored: EngineDeps = depsOf(BIGGER, ...ACTIONS.map((a) => a.ability));

function start(
  players: 1 | 2 | 3,
  card = WARDEN,
  using: EngineDeps = deps,
): { readonly state: GameState; readonly minion: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [WARDEN, GRUNT, ARMOR, TRACKER, ...ACTIONS.map((a) => a.card)],
    deps: using,
    players,
    encounter: [WARDEN.id, GRUNT.id, ARMOR.id, ...copiesOf(TREACHERY.id, 20)],
    deck: [TRACKER.id, ...ACTIONS.flatMap((a) => copiesOf(a.card.id, 2))],
  });
  const engaged = minionEngagedWith(playerCardIntoPlay(base, TRACKER.id).state, card.id);
  return { state: engaged.state, minion: engaged.id };
}

describe("a minion's hit points printed with the per player icon", () => {
  it.each([
    [1, 5],
    [2, 10],
    [3, 15],
  ] as const)("%i player(s): 5 per player is %i maximum hit points", (players, expected) => {
    const { state, minion } = start(players);
    expect(state.startingPlayerCount).toBe(players);
    expect(printedProfile(state, minion)?.maxHp).toBe(expected);
    expect(maxHitPoints(state, minion, deps)).toBe(expected);
    expect(remainingHitPoints(state, minion, deps)).toBe(expected);
  });

  it.each([1, 2, 3] as const)("%i player(s): a flat 5 stays 5", (players) => {
    const { state, minion } = start(players, GRUNT);
    expect(maxHitPoints(state, minion, deps)).toBe(5);
  });

  it("two players: 9 damage leaves 1 remaining and the minion in play; the tenth point defeats it", () => {
    const { state, minion } = start(2);
    const hurt = playFree(state, deps, NINE.card.id).state;
    expect(mustInstance(hurt, minion).damage).toBe(9);
    expect(remainingHitPoints(hurt, minion, deps)).toBe(1);
    expect(cardsInPlay(hurt)).toContain(minion);
    const dead = playFree(hurt, deps, ONE.card.id).state;
    expect(cardsInPlay(dead)).not.toContain(minion);
  });

  it("one player: the same 9 damage defeats it (5 hit points)", () => {
    const { state, minion } = start(1);
    expect(cardsInPlay(playFree(state, deps, NINE.card.id).state)).not.toContain(minion);
  });

  it("the icon is applied before modifiers: +2 hit points on 5 per player with three players is 17, not 21", () => {
    const { state, minion } = start(3, WARDEN, armored);
    const withArmor = minionEngagedWith(state, ARMOR.id).state;
    expect(maxHitPoints(withArmor, minion, armored)).toBe(17);
  });

  it("printed hit points are the product, and the numeral is the number before the icon", () => {
    const { state, minion } = start(3);
    expect(printedHpNumeral(state, minion)).toBe(5);
    const after = playFree(state, deps, MEASURE.card.id).state;
    const tracker = cardsInPlay(after).find(
      (id) => after.cardPool[mustInstance(after, id).cardId]?.name === "tracker",
    )!;
    expect(mustInstance(after, tracker).counters).toMatchObject({ printed: 15, numeral: 5 });
  });

  it("`maxPrintedHp` reads the product: 5 per player is over 'printed hit points 5 or fewer' with two players", () => {
    const one = start(1);
    const two = start(2);
    const query = { categories: ["minion" as const], maxPrintedHp: 5 };
    const context = (state: GameState) => ({
      selfInstanceId: state.players[0]!.identity.instanceId,
      controllerId: state.players[0]!.playerId,
      event: null,
      bindings: {},
      deps,
    });
    expect(selectTargets(one.state, query, context(one.state))).toContain(one.minion);
    expect(selectTargets(two.state, query, context(two.state))).not.toContain(two.minion);
  });

  it("an eliminated player does not lower it: still the number of players who started", () => {
    const { state, minion } = start(2);
    const fewer: GameState = {
      ...state,
      players: state.players.map((p, i) => (i === 1 ? { ...p, eliminated: true } : p)),
    };
    expect(maxHitPoints(fewer, minion, deps)).toBe(10);
  });
});
