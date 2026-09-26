/**
 * docs/phase7-wave5.md §4.1 Q18: a player who cannot pay a scheme's additional thwart cost cannot choose that scheme as
 * the target of a thwart. Synthetic side scheme shaped like Giant Monster Attack (`spdr`: "As an additional cost to
 * thwart this scheme, you must spend a [energy] resource").
 *
 * Source: RRG 1.8 "Cost" (p. 13), "Initiating Abilities" (p. 24) step 3.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubResource, stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const MONSTER_COST = stubAbility("monster.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "additionalThwartCost", scheme: { self: true }, resources: { energy: 1 } }],
  },
  effects: [],
});
const MONSTER = stubSideScheme({ id: "monster", startingThreat: 6, abilities: [MONSTER_COST.ref] });
const SPARK = stubResource({ id: "spark", icons: 0, produces: { energy: 1 } });
const DUD = stubResource({ id: "dud", icons: 0, produces: { mental: 1 } });

/** "Resource: Exhaust this card → generate an [energy] resource." */
const GENERATOR_RESOURCE = stubAbility("generator.resource", {
  trigger: { kind: "resource" },
  cost: { exhaustSelf: true },
  generates: { energy: 1 },
  effects: [],
} satisfies AbilityDefinition);
const GENERATOR = stubSupport({ id: "generator", cost: 0, abilities: [GENERATOR_RESOURCE.ref] });

/** "(thwart): Remove 1 threat from a scheme." */
const PROBE_ACTION = stubAbility("probe.action", {
  trigger: { kind: "action" },
  label: ["thwart"],
  effects: [
    { kind: "chooseTarget", slot: "scheme", query: { categories: ["scheme"] }, chooser: { kind: "controller" } },
    { kind: "thwart", target: { kind: "slot", slot: "scheme" }, amount: { kind: "const", value: 1 } },
  ] as EffectSpec[],
});
const PROBE = stubEvent({ id: "probe", cost: 0, abilities: [PROBE_ACTION.ref] });

const deps: EngineDeps = depsOf(MONSTER_COST, GENERATOR_RESOURCE, PROBE_ACTION);

/** P1 in hero form with an empty hand, 5 threat on the main scheme, the monster in the villain area with 6 threat. */
function start(): { readonly state: GameState; readonly scheme: InstanceId } {
  const state = gameAtFirstTurn({
    cards: [MONSTER, SPARK, DUD, GENERATOR, PROBE],
    deps,
    encounter: [MONSTER.id],
    deck: [...copiesOf(SPARK.id, 2), DUD.id, GENERATOR.id, PROBE.id],
  });
  const main = state.mainScheme.instanceId;
  const emptied = {
    ...state,
    instances: { ...state.instances, [main]: { ...mustInstance(state, main), threat: 5 } },
    players: state.players.map((p) => ({
      ...p,
      identity: { ...p.identity, form: "hero" as const },
      hand: [],
      deck: [...p.hand, ...p.deck],
    })),
  };
  const placed = encounterCardInVillainArea(emptied, MONSTER.id, 6);
  return { state: placed.state, scheme: placed.id };
}

const basicThwart = (state: GameState, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: mustPlayer(state, P1).identity.instanceId,
  schemeInstanceId: scheme,
});

/** The hero's basic thwart entry in `legalActions`: its targets and blocked targets. */
function heroThwart(state: GameState) {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error(`not P1's turn: ${actions.kind}`);
  const hero = mustPlayer(state, P1).identity.instanceId;
  const legal = actions.legal.find((a) => a.action.kind === "basicThwart" && a.action.instanceId === hero);
  const illegal = actions.illegal.find((a) => a.action.kind === "basicThwart" && a.action.instanceId === hero);
  return { targets: legal?.targets ?? [], blocked: legal?.blockedTargets ?? illegal?.blockedTargets ?? [] };
}

/** Pays a `spendResources` prompt with every option offered; anything else as `defaultPick`. */
const payAll = (s: GameState): readonly string[] => {
  const choice = s.pendingChoice;
  if (choice?.prompt.kind === "spendResources") return choice.options.map((o) => o.optionId);
  return defaultPick(s);
};

describe("§4.1 Q18 an unpayable additional thwart cost makes the scheme an illegal target", () => {
  it("with nothing that makes [energy], the scheme is refused and not offered; the main scheme still is", () => {
    const { state: bare, scheme } = start();
    const state = giveCard(bare, P1, DUD.id).state;
    const result = applyCommand(state, basicThwart(state, scheme), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("no_valid_target");
    const { targets, blocked } = heroThwart(state);
    expect(targets).not.toContain(scheme);
    expect(targets).toContain(state.mainScheme.instanceId);
    expect(blocked.find((b) => b.instanceId === scheme)?.reason).toBe("no_valid_target");
  });

  it("with an [energy] card in hand, it is offered and the paid thwart removes threat; replay deep-equal", () => {
    const { state: bare, scheme } = start();
    const state = giveCard(bare, P1, SPARK.id).state;
    expect(heroThwart(state).targets).toContain(scheme);
    const { session } = driveSession(startSession(state), deps, [basicThwart(state, scheme)], payAll);
    expect(mustInstance(session.state, scheme).threat).toBe(4);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a resource ability that generates [energy] counts as a way to pay", () => {
    const { state: bare, scheme } = start();
    const { state, id: generator } = playerCardIntoPlay(bare, GENERATOR.id);
    expect(heroThwart(state).targets).toContain(scheme);
    const { session } = driveSession(startSession(state), deps, [basicThwart(state, scheme)], payAll);
    expect(mustInstance(session.state, scheme).threat).toBe(4);
    expect(mustInstance(session.state, generator).exhausted).toBe(true);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a thwart effect's target choice leaves out a scheme it cannot pay for; replay deep-equal", () => {
    const { state: bare, scheme } = start();
    const { state, id: probe } = giveCard(bare, P1, PROBE.id);
    const offered: string[][] = [];
    const pick = (s: GameState): readonly string[] => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "chooseTarget") offered.push(choice.options.map((o) => o.optionId));
      return defaultPick(s);
    };
    const mainBefore = mustInstance(state, state.mainScheme.instanceId).threat;
    const { session } = driveSession(
      startSession(state),
      deps,
      [{ type: "playCard", playerId: P1, cardInstanceId: probe, payment: [], attachToInstanceId: null }],
      pick,
    );
    expect(offered.flat().some((option) => option.includes(scheme))).toBe(false);
    expect(mustInstance(session.state, scheme).threat).toBe(6);
    expect(mustInstance(session.state, state.mainScheme.instanceId).threat).toBe(mainBefore - 1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a thwart effect may choose the scheme when an [energy] card is in hand", () => {
    const { state: bare, scheme } = start();
    const withSpark = giveCard(bare, P1, SPARK.id).state;
    const { state, id: probe } = giveCard(withSpark, P1, PROBE.id);
    const played = applyCommand(
      state,
      { type: "playCard", playerId: P1, cardInstanceId: probe, payment: [], attachToInstanceId: null },
      deps,
    );
    if (!played.ok) throw new Error(played.error.message);
    const choice = played.state.pendingChoice;
    expect(choice?.prompt.kind).toBe("chooseTarget");
    expect(choice?.options.some((o) => o.ref.kind === "card" && o.ref.instanceId === scheme)).toBe(true);
  });
});
