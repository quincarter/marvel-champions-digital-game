/**
 * `resolvingWouldChange` (`resolve-ability-cost.ts`; docs/phase7-wave8.md §3.11, §4.1 Q7 = A): the probe that decides
 * whether a "resolve its 'Forced Response' →" cost can be paid. Code review, Piece 10b: what counts as a change is a
 * typed, exhaustive map of the state's fields; a probe asked for from inside a probe is run, not assumed payable.
 *
 * Sources: RRG 1.8 "Cost" (p. 13: paid in full or not at all); "Initiating Abilities" (p. 24: an ability whose cost
 * cannot be paid is not initiated).
 */

import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { PROBE_FIELDS, resolveAbilityCostFault, resolvingWouldChange, sameGame } from "./resolve-ability-cost.js";
import type { EffectSpec, Predicate, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubEnvironment, stubSupport } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const n = (value: number): ValueSpec => ({ kind: "const", value });
const you: TargetRef = { kind: "identityOf", player: { kind: "controller" } };
const forcedResponse = (id: string, ...effects: EffectSpec[]) =>
  stubAbility(`${id}.forced-response`, {
    trigger: { kind: "response", forced: true, on: { on: "enemyAttack", selfIs: "source" } },
    effects,
  });
const canAttack: Predicate = { kind: "canUseBasicPower", player: { kind: "controller" }, powers: ["attack"] };
const resolveOf = (of: TargetRef): AbilityCost => ({ resolveAbility: { of, trigger: "forcedResponse" } });
const basicAttackCosts = (id: string, cost: AbilityCost) =>
  stubAbility(`${id}.constant`, {
    trigger: { kind: "constant", basicPowerCosts: [{ power: "attack", cost }] },
    effects: [],
  });

/** "Forced Response: … if you can make a basic attack, deal 1 damage to your identity." */
const GATE_FR = forcedResponse("gate", {
  kind: "if",
  condition: canAttack,
  then: [{ kind: "dealDamage", target: you, amount: n(1) }],
});
/** "Forced Response: … discard a support you control." With no support, nothing happens. */
const LOSE_FR = forcedResponse(
  "loser",
  {
    kind: "chooseTarget",
    slot: "lost",
    query: { categories: ["support"], controller: "you" },
    chooser: { kind: "controller" },
  },
  { kind: "discardFromPlay", target: { kind: "slot", slot: "lost" } },
);
/** "As an additional cost for this character to make a basic attack, resolve its 'Forced Response'." */
const LOSE_TO_ATTACK = basicAttackCosts("loser", resolveOf({ kind: "self" }));
/** The same cost naming the gate, whose Forced Response asks whether this character can attack: a cost that leads back to itself. */
const GATE_TO_ATTACK = basicAttackCosts("looper", resolveOf({ kind: "each", query: { categories: ["environment"] } }));

const GATE = stubEnvironment({ id: "gate", abilities: [GATE_FR.ref] });
const LOSER = stubAlly({
  id: "loser",
  cost: 0,
  atk: 1,
  thw: null,
  hp: 3,
  abilities: [LOSE_FR.ref, LOSE_TO_ATTACK.ref],
});
const LOOPER = stubAlly({ id: "looper", cost: 0, atk: 1, thw: null, hp: 3, abilities: [GATE_TO_ATTACK.ref] });
const GEAR = stubSupport({ id: "gear", cost: 0 });

const deps: EngineDeps = depsOf(GATE_FR, LOSE_FR, LOSE_TO_ATTACK, GATE_TO_ATTACK);
const gateCost = resolveOf({ kind: "self" }).resolveAbility!;

/** P1 in alter-ego form (the identity cannot attack) with the gate in the villain's area. */
function start(): { state: GameState; gate: InstanceId } {
  const base = gameAtFirstTurn({
    players: 1,
    cards: [GATE, LOSER, LOOPER, GEAR],
    deps,
    deck: [LOSER.id, LOOPER.id, GEAR.id],
    encounter: [GATE.id, ...copiesOf(TREACHERY.id, 26)],
  });
  const gate = encounterCardInVillainArea(base, GATE.id);
  return { state: gate.state, gate: gate.id };
}
const heroDamage = (state: GameState): number => mustInstance(state, mustPlayer(state, P1).identity.instanceId).damage;

describe("what a probe compares (`PROBE_FIELDS`)", () => {
  const { state } = start();

  it("places every field a game's state holds", () => {
    expect(Object.keys(state).filter((key) => !(key in PROBE_FIELDS))).toEqual([]);
  });

  it("a state that differs only in bookkeeping is the same game; one that differs in a game field is not", () => {
    const bookkeeping = Object.entries(PROBE_FIELDS).flatMap(([key, kind]) => (kind === "bookkeeping" ? [key] : []));
    expect(bookkeeping.toSorted()).toEqual(
      [
        "abilityUses",
        "deckTopsAnnounced",
        "encounterTopAnnounced",
        "hitPointsSeen",
        "nextChoiceSeq",
        "nextFrameSeq",
        "nextLastingSeq",
        "pendingChoice",
        "stack",
        "stateChecks",
      ].toSorted(),
    );
    const touched: GameState = {
      ...state,
      stack: [],
      pendingChoice: null,
      nextFrameSeq: state.nextFrameSeq + 9,
      nextChoiceSeq: state.nextChoiceSeq + 9,
      nextLastingSeq: state.nextLastingSeq + 9,
      abilityUses: { ...state.abilityUses, "x:y": 1 },
      stateChecks: { ...state.stateChecks, "x:y": true },
      hitPointsSeen: { x: 3 },
      deckTopsAnnounced: { [P1]: "x" as InstanceId },
    };
    expect(sameGame(state, touched)).toBe(true);
    // Rebuilt with the same content is the same game; any game field with other content is not.
    expect(sameGame(state, { ...state, players: state.players.map((p) => ({ ...p })) })).toBe(true);
    expect(sameGame(state, { ...state, round: state.round + 1 })).toBe(false);
    expect(sameGame(state, { ...state, rng: { ...state.rng, calls: -1 } as GameState["rng"] })).toBe(false);
    expect(sameGame(state, { ...state, pendingLeftPlay: [] })).toBe(false);
    expect(sameGame(state, { ...state, lastingEffects: [...state.lastingEffects, {} as never] })).toBe(false);
  });
});

describe("resolvingWouldChange", () => {
  it("abilities that resolve and leave only bookkeeping behind (frames, a choice with nothing to choose) change nothing", () => {
    const { state } = start();
    const loser = playerCardIntoPlay(state, LOSER.id);
    const cost = gateCost;
    expect(resolvingWouldChange(loser.state, deps, loser.id, P1, loser.id, cost)).toBe(false);
    expect(resolveAbilityCostFault(loser.state, deps, loser.id, P1, loser.id, cost)).toBe(
      "resolving that ability would change nothing",
    );
    const geared = playerCardIntoPlay(loser.state, GEAR.id);
    expect(resolvingWouldChange(geared.state, deps, loser.id, P1, loser.id, cost)).toBe(true);
  });

  it("a probe asked for inside a probe is run: the inner cost unpayable, the outer abilities do nothing", () => {
    const { state, gate } = start();
    // The gate deals damage only if the ally can attack, and the ally attacks only by resolving its own Forced
    // Response, which changes nothing with no support in play. Assumed payable, the gate would read as dealing damage.
    const loser = playerCardIntoPlay(state, LOSER.id);
    expect(resolvingWouldChange(loser.state, deps, gate, P1, gate, gateCost)).toBe(false);
    // With a support to discard the inner cost is payable, so the gate's damage is a change.
    const geared = playerCardIntoPlay(loser.state, GEAR.id);
    expect(resolvingWouldChange(geared.state, deps, gate, P1, gate, gateCost)).toBe(true);
    // Asking resolved nothing in the game it was asked about.
    expect(heroDamage(geared.state)).toBe(0);
    expect(geared.state.stack).toEqual(loser.state.stack);
  });

  it("a cost whose abilities lead back to itself ends: past the depth probes nest to, it is not payable", () => {
    const { state, gate } = start();
    const looper = playerCardIntoPlay(state, LOOPER.id);
    expect(resolvingWouldChange(looper.state, deps, gate, P1, gate, gateCost)).toBe(false);
  });
});
