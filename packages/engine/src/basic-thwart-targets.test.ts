/**
 * docs/phase7-wave5.md §3.22: a basic thwart that may remove threat only from one scheme. Synthetic upgrade shaped like
 * Retinal Display (`sm` 27186a: "Your hero's basic thwart power (THW) can only remove threat from the scheme with the
 * most threat. Your hero gets +1 THW, and your hero's basic thwarts ignore the crisis icon").
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubSideScheme, stubUpgrade } from "./testing/fixtures.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const yourHero = { categories: ["hero" as const], controller: "you" as const };
const mostThreat: TargetRef = {
  kind: "superlative",
  order: "highest",
  among: { kind: "each", query: { categories: ["scheme"] } },
  measure: { kind: "threat", of: { kind: "slot", slot: "candidate" } },
};
const RETINAL_DEFINITION: AbilityDefinition = {
  trigger: {
    kind: "constant",
    rules: [
      { kind: "basicThwartTargets", character: yourHero, among: mostThreat },
      { kind: "characterIgnores", target: yourHero, ignores: ["crisis"], basicOnly: true },
    ],
  },
  effects: [],
};
const RETINAL_CONSTANT = stubAbility("retinal.constant", RETINAL_DEFINITION);
const RETINAL = stubUpgrade({ id: "retinal", cost: 0, abilities: [RETINAL_CONSTANT.ref] });
const BIG = stubSideScheme({ id: "big", startingThreat: 9 });
const SMALL = stubSideScheme({ id: "small", startingThreat: 2 });
const CRISIS = stubSideScheme({ id: "crisis", startingThreat: 1, icons: ["crisis"] });

const THWART_MAIN_ACTION = stubAbility("thwart-main.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "thwart", target: { kind: "mainScheme" }, amount: { kind: "const", value: 1 } }] as EffectSpec[],
});
const THWART_MAIN = stubEvent({ id: "thwart-main", cost: 0, abilities: [THWART_MAIN_ACTION.ref] });

const deps: EngineDeps = depsOf(RETINAL_CONSTANT, THWART_MAIN_ACTION);

function start(): GameState {
  const state = gameAtFirstTurn({
    cards: [RETINAL, BIG, SMALL, CRISIS, THWART_MAIN],
    deps,
    encounter: [BIG.id, SMALL.id, CRISIS.id],
    deck: [RETINAL.id, THWART_MAIN.id],
  });
  const hero = {
    ...state,
    players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  return playerCardIntoPlay(hero, RETINAL.id).state;
}

const basicThwart = (state: GameState, scheme: InstanceId) => ({
  type: "basicThwart" as const,
  playerId: P1,
  thwarterInstanceId: mustPlayer(state, P1).identity.instanceId,
  schemeInstanceId: scheme,
});

describe("§3.22 'can only remove threat from the scheme with the most threat'", () => {
  it("refuses another scheme and thwarts the one with the most threat; replay deep-equal", () => {
    const withBig = encounterCardInVillainArea(start(), BIG.id, 9);
    const { state, id: small } = encounterCardInVillainArea(withBig.state, SMALL.id, 2);
    expect(applyCommand(state, basicThwart(state, small), deps).ok).toBe(false);
    const { session } = driveSession(startSession(state), deps, [basicThwart(state, withBig.id)]);
    expect(mustInstance(session.state, withBig.id).threat).toBeLessThan(9);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});

describe("§3.22 'your hero's basic thwarts ignore the crisis icon'", () => {
  it("a basic thwart of the main scheme ignores a crisis icon; a thwart event does not", () => {
    const base = start();
    const main = base.mainScheme.instanceId;
    const raised = { ...base, instances: { ...base.instances, [main]: { ...mustInstance(base, main), threat: 8 } } };
    const { state } = encounterCardInVillainArea(raised, CRISIS.id, 1);
    const { session } = driveSession(startSession(state), deps, [basicThwart(state, main)]);
    expect(mustInstance(session.state, main).threat).toBeLessThan(8);
    // The thwart event is not a basic thwart: the crisis icon leaves it no valid target.
    expect(() => playFree(state, deps, THWART_MAIN.id)).toThrow(/no valid target/);
  });
});
