/**
 * docs/phase7-wave4.md §3.15 ("After the last X counter is removed from here") and §3.16 (encounter cards in a player's
 * play area). Synthetic cards shaped like Ebony Maw's Spell environments (`mts` 21076–21079): "Surge. Enters play with 2
 * invocation counters on it. Forced Response: After the last invocation counter is removed from Fireball, discard it →
 * deal 4 damage to your identity", and Ebony Maw's "remove an invocation counter from each Spell card in your play area".
 *
 * Sources: MC21 p. 6 ("When a player reveals a Spell environment, they place that card in front of them in their play
 * area"; the worked example: the last counter removed, Fireball's ability triggers, "Spider-Man immediately takes four
 * damage"); RRG 1.8 "Environment" (p. 18), "Response" (p. 38).
 */

import { flat, trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { locateCard, mustInstance, mustPlayer } from "./query.js";
import { selectTargets } from "./select.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEnvironment, stubEvent, stubVillain } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1, playFree } from "./testing/wave3.js";

const SPELL = trait("SPELL");
const self: TargetRef = { kind: "self" };
const yourIdentity: TargetRef = { kind: "identityOf", player: { kind: "controller" } };

const SPELL_RULE = stubAbility("ebony-maw.constant", {
  trigger: { kind: "constant", rules: [{ kind: "entersRevealersPlayArea", cards: { trait: SPELL } }] },
  effects: [],
});
const MAW = stubVillain({
  id: "ebony-maw",
  name: "Ebony Maw",
  stages: [{ hp: flat(30), atk: 0, sch: 0, abilities: [SPELL_RULE.ref] }],
});

const FIREBALL_ENTERS = stubAbility("fireball.enters", {
  trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", selfIs: "target" } },
  effects: [{ kind: "addCounters", target: self, counterType: "invocation", amount: { kind: "const", value: 2 } }],
});
const FIREBALL_LAST = stubAbility("fireball.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: {
      on: "countersRemoved",
      selfIs: "target",
      eventIs: { counterType: "invocation" },
      eventAtMost: { remaining: 0 },
    },
  },
  effects: [
    { kind: "discardFromPlay", target: self },
    { kind: "dealDamage", target: yourIdentity, amount: { kind: "const", value: 4 } },
  ],
});
const FIREBALL = stubEnvironment({
  id: "fireball",
  traits: [SPELL],
  abilities: [FIREBALL_ENTERS.ref, FIREBALL_LAST.ref],
});
const PLAIN = stubEnvironment({ id: "plain-environment" });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** Reveals the top card of the encounter deck for its player. */
const REVEAL = event("reveal", [{ kind: "revealEncounterCard", player: { kind: "controller" } }]);
/** "Remove an invocation counter from each Spell card in your play area." */
const CHANNEL = event("channel", [
  {
    kind: "removeCounters",
    target: { kind: "each", query: { trait: SPELL, inPlayAreaOf: { kind: "controller" } } },
    counterType: "invocation",
    amount: { kind: "const", value: 1 },
  },
]);
const EVENTS = [REVEAL, CHANNEL];
const deps: EngineDeps = depsOf(SPELL_RULE, FIREBALL_ENTERS, FIREBALL_LAST, ...EVENTS.map((e) => e.ability));

function start(top: typeof FIREBALL): GameState {
  const base = gameAtFirstTurn({
    cards: [MAW, FIREBALL, PLAIN, ...EVENTS.map((e) => e.card)],
    deps,
    villain: MAW,
    encounter: [FIREBALL.id, PLAIN.id, ...copiesOf(TREACHERY.id, 10)],
    deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 3)),
  });
  return onTopOfEncounterDeck(base, top.id);
}
const idOf = (state: GameState, card: typeof FIREBALL): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === card.id)!.instanceId;
const identityDamage = (state: GameState): number =>
  mustInstance(state, mustPlayer(state, P1).identity.instanceId).damage;

describe("§3.16 encounter cards in a player's play area", () => {
  it("a revealed Spell environment goes in front of the revealing player, controlled by no one; others to the villain's area", () => {
    const revealed = playFree(start(FIREBALL), deps, REVEAL.card.id).state;
    const fireball = idOf(revealed, FIREBALL);
    expect(locateCard(revealed, fireball)).toEqual({ kind: "playArea", playerId: P1 });
    expect(mustInstance(revealed, fireball).controllerId).toBeNull();
    const context = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };
    expect(selectTargets(revealed, { inPlayAreaOf: { kind: "controller" } }, context)).toContain(fireball);
    const plain = playFree(start(PLAIN), deps, REVEAL.card.id).state;
    expect(locateCard(plain, idOf(plain, PLAIN))).toEqual({ kind: "villainArea" });
  });
});

describe("§3.15 'after the last X counter is removed from here'", () => {
  it("fires on the last counter only; the Spell is discarded and 'your identity' is its play area's player", () => {
    const revealed = playFree(start(FIREBALL), deps, REVEAL.card.id).state;
    const fireball = idOf(revealed, FIREBALL);
    expect(mustInstance(revealed, fireball).counters["invocation"]).toBe(2);
    const once = playFree(revealed, deps, CHANNEL.card.id).state;
    expect(mustInstance(once, fireball).counters["invocation"]).toBe(1);
    expect(identityDamage(once)).toBe(0);
    const { state: twice, session } = playFree(once, deps, CHANNEL.card.id);
    expect(locateCard(twice, fireball)).not.toEqual({ kind: "playArea", playerId: P1 });
    expect(identityDamage(twice)).toBe(4);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});

describe("§3.40 a scenario rule with no card behind it", () => {
  it("MC21 p. 6's Spell rule seeded at setup routes a revealed Spell to the revealer's play area, with no villain constant", () => {
    const PLAIN_MAW = stubVillain({ id: "plain-maw", name: "Ebony Maw", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
    const base = gameAtFirstTurn({
      cards: [PLAIN_MAW, FIREBALL, PLAIN, ...EVENTS.map((e) => e.card)],
      deps,
      villain: PLAIN_MAW,
      encounter: [FIREBALL.id, PLAIN.id, ...copiesOf(TREACHERY.id, 10)],
      deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 3)),
      scenarioRuleSpecs: [{ kind: "entersRevealersPlayArea", cards: { trait: SPELL } }],
    });
    const revealed = playFree(onTopOfEncounterDeck(base, FIREBALL.id), deps, REVEAL.card.id).state;
    expect(locateCard(revealed, idOf(revealed, FIREBALL))).toEqual({ kind: "playArea", playerId: P1 });
    const without = gameAtFirstTurn({
      cards: [PLAIN_MAW, FIREBALL, PLAIN, ...EVENTS.map((e) => e.card)],
      deps,
      villain: PLAIN_MAW,
      encounter: [FIREBALL.id, PLAIN.id, ...copiesOf(TREACHERY.id, 10)],
      deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 3)),
    });
    const plain = playFree(onTopOfEncounterDeck(without, FIREBALL.id), deps, REVEAL.card.id).state;
    expect(locateCard(plain, idOf(plain, FIREBALL))).toEqual({ kind: "villainArea" });
  });
});
