/**
 * `RuleSpec doubleNextCardSpent`: "Response: After you spend this card, treat the next card you spend as if it has
 * double the resources." (community pack `yondu-dh`, Jackpot!; until the end of the round, a reading settled with the
 * pack's authors). Granted as a lasting rule (`applyRuleUntil`): the first card from hand its player spends in a later
 * payment generates double, logged `spentCardDoubled`, and the grant ends `consumed`. Cards of one payment are spent
 * together (RRG 1.8 "Cost", p. 13), so the card whose response made the grant, and the cards spent with it, are not
 * "next".
 *
 * Synthetic cards throughout. RESOURCE is a 1-wild resource card.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { doubledPaymentSource, paymentFor, tryPayment } from "./legal.js";
import { mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubResource } from "./testing/fixtures.js";
import { giveCard, RESOURCE } from "./testing/scenario.js";
import { gameAtFirstTurn, P1 } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const draw1: EffectSpec = { kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } };
const grant: EffectSpec = { kind: "applyRuleUntil", rule: { kind: "doubleNextCardSpent" }, until: "endOfRound" };

// "Response: After you spend this card, treat the next card you spend as if it has double the resources." (forced here,
// so the test needs no pick.)
const JACKPOT_RESPONSE = stubAbility(
  "jackpot.response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "resourcesSpent", selfIs: "source", playerIs: "controller" } },
    effects: [grant],
  }),
);
const JACKPOT = stubResource({ id: "jackpot", icons: 1, abilities: [JACKPOT_RESPONSE.ref] });
const event = (id: string, cost: number, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, def({ trigger: { kind: "action" }, effects }));
  return { card: stubEvent({ id, cost, abilities: [ability.ref] }), ability };
};
const GRANT = event("grant", 0, [grant]);
const TWO = event("two", 2, [draw1]);
const THREE = event("three", 3, [draw1]);

const deps: EngineDeps = depsOf(JACKPOT_RESPONSE, GRANT.ability, TWO.ability, THREE.ability);

function start(): GameState {
  return gameAtFirstTurn({
    cards: [JACKPOT, GRANT.card, TWO.card, THREE.card],
    deps,
    deck: [JACKPOT.id, GRANT.card.id, TWO.card.id, TWO.card.id, THREE.card.id],
  });
}
/** Hands the player the named cards (test surgery), in order. */
function hand(state: GameState, ...cards: readonly string[]): { state: GameState; ids: InstanceId[] } {
  let current = state;
  const ids: InstanceId[] = [];
  for (const card of cards) {
    const given = giveCard(current, P1, card, ids);
    current = given.state;
    ids.push(given.id);
  }
  return { state: current, ids };
}
const play = (card: InstanceId, payment: readonly InstanceId[] = []): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment: payment.map((fromHand) => ({ fromHand })),
  attachToInstanceId: null,
});
const grants = (state: GameState) =>
  state.lastingEffects.filter((e) => e.kind === "ruleGrant" && e.rule.kind === "doubleNextCardSpent");
const doubled = (events: readonly GameEvent[]) => events.flatMap((e) => (e.type === "spentCardDoubled" ? [e] : []));

describe("doubleNextCardSpent: 'treat the next card you spend as if it has double the resources'", () => {
  it("the next card spent counts double, once: a 1-resource card pays for a 2-cost card, then the grant is gone", () => {
    const given = hand(start(), GRANT.card.id, TWO.card.id, RESOURCE.id);
    const [grantCard, two, res] = given.ids as [InstanceId, InstanceId, InstanceId];
    const granted = runCommands(given.state, deps, play(grantCard));
    expect(grants(granted.state)).toHaveLength(1);
    expect(grants(granted.state)[0]!.duration).toEqual({ kind: "endOfRound" });
    const paid = runCommands(granted.state, deps, play(two, [res]));
    expect(doubled(paid.events)).toEqual([
      {
        type: "spentCardDoubled",
        playerId: P1,
        instanceId: res,
        factor: 2,
        lastingEffectIds: [grants(granted.state)[0]!.id],
      },
    ]);
    const committed = paid.events.find((e) => e.type === "paymentCommitted");
    expect(committed?.type === "paymentCommitted" && committed.fromHand[0]!.resources.wild).toBe(2);
    expect(grants(paid.state)).toEqual([]);
    expect(paid.events.some((e) => e.type === "lastingEffectEnded" && e.reason === "consumed")).toBe(true);
  });

  it("used up: the card after the next one counts as printed", () => {
    const given = hand(start(), GRANT.card.id, TWO.card.id, TWO.card.id, RESOURCE.id, RESOURCE.id, RESOURCE.id);
    const [grantCard, twoA, twoB, resA, resB, resC] = given.ids as [
      InstanceId,
      InstanceId,
      InstanceId,
      InstanceId,
      InstanceId,
      InstanceId,
    ];
    const paid = runCommands(given.state, deps, play(grantCard), play(twoA, [resA]));
    const again = applyCommand(paid.state, play(twoB, [resB]), deps);
    expect(again.ok).toBe(false);
    expect(!again.ok && again.error.code).toBe("insufficient_resources");
    // Two printed resources pay it, and nothing is doubled.
    const printed = runCommands(paid.state, deps, play(twoB, [resB, resC]));
    expect(mustPlayer(printed.state, P1).hand).not.toContain(twoB);
    expect(doubled(printed.events)).toEqual([]);
  });

  it("several cards in one payment: only the first is doubled (1 doubled + 1 pays 3)", () => {
    const given = hand(start(), GRANT.card.id, THREE.card.id, RESOURCE.id, RESOURCE.id);
    const [grantCard, three, resA, resB] = given.ids as [InstanceId, InstanceId, InstanceId, InstanceId];
    const paid = runCommands(given.state, deps, play(grantCard), play(three, [resA, resB]));
    expect(doubled(paid.events).map((e) => e.instanceId)).toEqual([resA]);
    expect(mustPlayer(paid.state, P1).hand).not.toContain(three);
  });

  it("the card that made the grant, and the cards spent with it, are not the next card", () => {
    const given = hand(start(), JACKPOT.id, RESOURCE.id, TWO.card.id, TWO.card.id, RESOURCE.id);
    const [jackpot, resA, twoA, twoB, resB] = given.ids as [InstanceId, InstanceId, InstanceId, InstanceId, InstanceId];
    const first = runCommands(given.state, deps, play(twoA, [jackpot, resA]));
    expect(doubled(first.events)).toEqual([]);
    expect(grants(first.state)).toHaveLength(1);
    const second = runCommands(first.state, deps, play(twoB, [resB]));
    expect(doubled(second.events).map((e) => e.instanceId)).toEqual([resB]);
    expect(grants(second.state)).toEqual([]);
  });

  it("the pay step: each hand card has its plain and its doubled pool, and the first card picked is the doubled one", () => {
    const given = hand(start(), GRANT.card.id, THREE.card.id, RESOURCE.id, RESOURCE.id, RESOURCE.id);
    const [grantCard, three, resA, resB, resC] = given.ids as [
      InstanceId,
      InstanceId,
      InstanceId,
      InstanceId,
      InstanceId,
    ];
    const playThree = { kind: "playCard", instanceId: three } as const;
    const granted = runCommands(given.state, deps, play(grantCard)).state;
    const query = paymentFor(granted, P1, playThree, { target: null }, deps)!;
    const source = (id: InstanceId) => query.sources.find((s) => s.kind === "handCard" && s.instanceId === id)!;
    for (const id of [resA, resB, resC]) {
      expect(source(id).pool).toMatchObject({ wild: 1 });
      expect(source(id).doubledPool).toMatchObject({ wild: 2 });
    }
    const ids = (...cards: InstanceId[]) => cards.map((id) => source(id).optionId);
    expect(doubledPaymentSource(granted, P1, ids(resA, resB, resC), deps)).toBe(resA);
    expect(doubledPaymentSource(granted, P1, ids(resC, resA), deps)).toBe(resC);
    expect(doubledPaymentSource(granted, P1, [], deps)).toBeNull();
    // 2 + 1 pays 3: the doubled first card and one more.
    expect(tryPayment(granted, P1, playThree, ids(resB, resA), { target: null }, deps).ok).toBe(true);
    // Without a grant there is no doubled pool and no doubled card.
    const plain = paymentFor(given.state, P1, playThree, { target: null }, deps)!;
    expect(plain.sources.every((s) => s.doubledPool === undefined)).toBe(true);
    expect(doubledPaymentSource(given.state, P1, ids(resA), deps)).toBeNull();
  });

  it("no grant: a payment is priced as printed and logs nothing", () => {
    const given = hand(start(), TWO.card.id, RESOURCE.id);
    const [two, res] = given.ids as [InstanceId, InstanceId];
    expect(applyCommand(given.state, play(two, [res]), deps).ok).toBe(false);
  });
});
