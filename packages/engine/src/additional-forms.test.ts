/**
 * docs/phase7-wave4.md §3.1: additional forms, the "[type] form" keyword. Synthetic cards shaped like Spectrum's three
 * energy forms (Gamma, Photon, Pulsar, `mts` 21002–21004: single-faced, put into play facedown by Monica Rambeau's Setup,
 * "flip that card faceup to change to that energy form", "After you change to this energy form") and Vision's mass form
 * upgrade (Intangible / Dense, `vision` 26002: one double-sided card, "Change mass form by flipping your mass form upgrade
 * over"), with a support that listens like Moxie ("After you change form") and like an identity face's "After you change
 * to this form".
 *
 * Sources: RRG 1.8 "Form, Change Form" (p. 21): "Cards with the '[type] form' keyword grant an identity unique forms.
 * These forms are in addition to the identity's alter-ego and hero forms […] When an identity changes their additional
 * form, it does not count against the once-per-turn limit on flipping from hero to alter-ego (or vice versa), but it does
 * count as changing form for the purpose of triggering card effects." MC21 p. 2, "Additional Forms".
 */

import { unerrataedText, type KeywordInstance, type UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, EventPattern } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { evaluate, selectTargets } from "./select.js";
import type { EffectSpec, Predicate, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { driveSession } from "./testing/drive.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const one = { kind: "const", value: 1 } as const;
const self: TargetRef = { kind: "self" };
const count = (counterType: string, target: TargetRef = self): EffectSpec => ({
  kind: "addCounters",
  target,
  counterType,
  amount: one,
});
const forced = (id: string, on: EventPattern, effects: readonly EffectSpec[]): StubAbility =>
  stubAbility(id, { trigger: { kind: "response", forced: true, on }, effects } satisfies AbilityDefinition);

const formKeywords = (formType: string): readonly KeywordInstance[] => [
  { name: "form", formType },
  { name: "permanent" },
];

/** "Hero Response: After you change to this energy form, …" on the form card itself. */
const thisForm = (name: string) =>
  forced(
    `${name}.this-form`,
    { on: "formChanged", playerIs: "controller", selfIs: "target", eventIs: { change: "additional" } },
    [count("heard")],
  );
const GAMMA_HEARD = thisForm("gamma");
const PHOTON_HEARD = thisForm("photon");
const energy = (id: string, name: string, heard: StubAbility): UpgradeCard => ({
  ...stubUpgrade({ id, cost: 0, keywords: formKeywords("energy"), abilities: [heard.ref] }),
  name,
  specialCost: "dash",
});
const GAMMA = energy("gamma", "Gamma", GAMMA_HEARD);
const PHOTON = energy("photon", "Photon", PHOTON_HEARD);
const PULSAR = energy("pulsar", "Pulsar", thisForm("pulsar"));

const DENSE_HEARD = thisForm("dense");
const MASS: UpgradeCard = {
  ...stubUpgrade({ id: "mass", cost: 0, keywords: formKeywords("mass") }),
  name: "Intangible",
  flipSide: {
    name: "Dense",
    traits: [],
    keywords: formKeywords("mass"),
    text: unerrataedText("Mass form. Permanent."),
    abilities: [DENSE_HEARD.ref],
  },
};

/** Listens like Moxie ("After you change form") and like an identity face's "After you change to this form". */
const ANY_CHANGE = forced("tracker.any", { on: "formChanged", playerIs: "controller" }, [count("anyChange")]);
const IDENTITY_CHANGE = forced(
  "tracker.identity",
  { on: "formChanged", playerIs: "controller", eventIs: { change: "identity" } },
  [count("identityChange")],
);
const TRACKER = stubSupport({ id: "tracker", cost: 0, abilities: [ANY_CHANGE.ref, IDENTITY_CHANGE.ref] });

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const change = (formType: string, opts: { toName?: string; to?: TargetRef } = {}): EffectSpec => ({
  kind: "changeAdditionalForm",
  player: { kind: "controller" },
  formType,
  ...opts,
});
const SETUP = actionEvent("power-down", [
  {
    kind: "turnFacedown",
    target: { kind: "each", query: { printedForm: "energy", controller: "you" } },
  },
]);
const TO_GAMMA = actionEvent("to-gamma", [change("energy", { toName: "Gamma" })]);
const TO_PHOTON = actionEvent("to-photon", [change("energy", { toName: "Photon" })]);
const FLIP_MASS = actionEvent("flip-mass", [change("mass")]);
const TO_DENSE = actionEvent("to-dense", [change("mass", { toName: "Dense" })]);
const LOSS_OF_CONTROL = actionEvent("loss-of-control", [
  {
    kind: "applyRuleUntil",
    rule: { kind: "cannotChangeForm", player: { kind: "controller" }, formType: "energy" },
    until: "endOfRound",
  },
]);
const EVENTS = [SETUP, TO_GAMMA, TO_PHOTON, FLIP_MASS, TO_DENSE, LOSS_OF_CONTROL];

const deps: EngineDeps = depsOf(
  GAMMA_HEARD,
  PHOTON_HEARD,
  thisForm("pulsar"),
  DENSE_HEARD,
  ANY_CHANGE,
  IDENTITY_CHANGE,
  ...EVENTS.map((e) => e.ability),
);

interface Board {
  readonly state: GameState;
  readonly gamma: InstanceId;
  readonly photon: InstanceId;
  readonly pulsar: InstanceId;
  readonly mass: InstanceId;
  readonly tracker: InstanceId;
}

function start(): Board {
  const base = gameAtFirstTurn({
    cards: [GAMMA, PHOTON, PULSAR, MASS, TRACKER, ...EVENTS.map((e) => e.card)],
    deps,
    deck: [GAMMA.id, PHOTON.id, PULSAR.id, MASS.id, TRACKER.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 3))],
  });
  const gamma = playerCardIntoPlay(base, GAMMA.id);
  const photon = playerCardIntoPlay(gamma.state, PHOTON.id);
  const pulsar = playerCardIntoPlay(photon.state, PULSAR.id);
  const mass = playerCardIntoPlay(pulsar.state, MASS.id);
  const tracker = playerCardIntoPlay(mass.state, TRACKER.id);
  // Monica Rambeau's Setup: "Put all 3 energy form upgrades into play, facedown."
  const state = playFree(tracker.state, deps, SETUP.card.id).state;
  return { state, gamma: gamma.id, photon: photon.id, pulsar: pulsar.id, mass: mass.id, tracker: tracker.id };
}

const context = (state: GameState) => ({
  selfInstanceId: mustPlayer(state, P1).identity.instanceId,
  controllerId: P1,
  event: null,
  bindings: {},
  deps,
});
const inForm = (state: GameState, formType: string, name?: string): boolean => {
  const predicate: Predicate = {
    kind: "inAdditionalForm",
    player: { kind: "controller" },
    formType,
    ...(name ? { name } : {}),
  };
  return evaluate(state, predicate, context(state));
};
/** The once-per-round hero/alter-ego flip, driven through its windows. */
const flipIdentity = (state: GameState): GameState =>
  driveSession(startSession(state), deps, [{ type: "changeForm", playerId: P1 }]).session.state;
const counter = (state: GameState, id: InstanceId, type: string): number => mustInstance(state, id).counters[type] ?? 0;

describe("§3.1 additional forms", () => {
  it("a facedown form card grants no form and has no title, but the owner can still find it by its printed form", () => {
    const { state, gamma } = start();
    expect(mustInstance(state, gamma).facedownAs).not.toBeNull();
    expect(inForm(state, "energy")).toBe(false);
    expect(selectTargets(state, { name: "Gamma" }, context(state))).toEqual([]);
    expect(selectTargets(state, { printedForm: "energy", facedown: true }, context(state))).toHaveLength(3);
    // The mass form card is faceup on its front: Intangible.
    expect(inForm(state, "mass", "Intangible")).toBe(true);
    expect(inForm(state, "mass", "Dense")).toBe(false);
  });

  it("changing to an energy form turns it faceup, is a change of form for 'After you change form', not for 'change to this form' on the identity", () => {
    const { state, gamma, photon, tracker } = start();
    const { state: after, events } = playFree(state, deps, TO_GAMMA.card.id);
    expect(mustInstance(after, gamma).facedownAs).toBeNull();
    expect(inForm(after, "energy", "Gamma")).toBe(true);
    expect(counter(after, tracker, "anyChange")).toBe(1);
    expect(counter(after, tracker, "identityChange")).toBe(0);
    // "After you change to this energy form" on Gamma, not on the still-facedown Photon.
    expect(counter(after, gamma, "heard")).toBe(1);
    expect(counter(after, photon, "heard")).toBe(0);
    expect(events).toContainEqual(expect.objectContaining({ type: "additionalFormChanged", formName: "Gamma" }));
    // It never uses the once-per-round form change.
    expect(mustPlayer(after, P1).identity.changedFormThisRound).toBe(false);
  });

  it("one energy form shows at a time: changing to another turns the first facedown", () => {
    const { state, gamma, photon } = start();
    const gammaUp = playFree(state, deps, TO_GAMMA.card.id).state;
    const photonUp = playFree(gammaUp, deps, TO_PHOTON.card.id).state;
    expect(mustInstance(photonUp, gamma).facedownAs).not.toBeNull();
    expect(mustInstance(photonUp, photon).facedownAs).toBeNull();
    expect(inForm(photonUp, "energy", "Photon")).toBe(true);
    expect(inForm(photonUp, "energy", "Gamma")).toBe(false);
  });

  it("changing to the form already showing changes nothing and triggers nothing", () => {
    const { state, tracker, gamma } = start();
    const once = playFree(state, deps, TO_GAMMA.card.id).state;
    const twice = playFree(once, deps, TO_GAMMA.card.id).state;
    expect(counter(twice, tracker, "anyChange")).toBe(1);
    expect(counter(twice, gamma, "heard")).toBe(1);
  });

  it("'You cannot change energy forms' stops an energy change but neither a mass change nor the hero/alter-ego flip", () => {
    const { state, gamma, tracker } = start();
    const locked = playFree(state, deps, LOSS_OF_CONTROL.card.id).state;
    const tried = playFree(locked, deps, TO_GAMMA.card.id).state;
    expect(mustInstance(tried, gamma).facedownAs).not.toBeNull();
    expect(counter(tried, tracker, "anyChange")).toBe(0);
    const massed = playFree(tried, deps, FLIP_MASS.card.id).state;
    expect(inForm(massed, "mass", "Dense")).toBe(true);
    const before = mustPlayer(massed, P1).identity.form;
    const flipped = flipIdentity(massed);
    expect(mustPlayer(flipped, P1).identity.form).not.toBe(before);
  });

  it("a double-sided form card changes by flipping; naming the face already showing changes nothing", () => {
    const { state, mass, tracker } = start();
    const { state: dense, events } = playFree(state, deps, FLIP_MASS.card.id);
    expect(mustInstance(dense, mass).flipped).toBe(true);
    expect(inForm(dense, "mass", "Dense")).toBe(true);
    expect(counter(dense, mass, "heard")).toBe(1); // Dense's own "After you change to this mass form".
    expect(events).toContainEqual(expect.objectContaining({ type: "cardFlipped", instanceId: mass }));
    const again = playFree(dense, deps, TO_DENSE.card.id).state;
    expect(mustInstance(again, mass).flipped).toBe(true);
    expect(counter(again, tracker, "anyChange")).toBe(1);
  });

  it("the hero/alter-ego flip is an identity change: both listeners hear it", () => {
    const { state, tracker } = start();
    const flipped = flipIdentity(state);
    expect(counter(flipped, tracker, "anyChange")).toBe(1);
    expect(counter(flipped, tracker, "identityChange")).toBe(1);
  });

  it("replays deep-equal", () => {
    const { state } = start();
    const gammaUp = playFree(state, deps, TO_GAMMA.card.id).state;
    const { session } = playFree(gammaUp, deps, FLIP_MASS.card.id);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
