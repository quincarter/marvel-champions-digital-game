/**
 * docs/phase7-wave5.md §4.1 Q18: a player who cannot pay a scheme's additional thwart cost cannot choose that scheme as
 * the target of a thwart. Synthetic side scheme shaped like Giant Monster Attack (`spdr`: "As an additional cost to
 * thwart this scheme, you must spend a [energy] resource").
 *
 * Source: RRG 1.8 "Cost" (p. 13), "Initiating Abilities" (p. 24) step 3.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command, Payment } from "./commands.js";
import { applyCommand, replay, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubResource, stubSideScheme, stubSupport } from "./testing/fixtures.js";
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

/** Cat in a Tree's shape (`spiderham`): "As an additional cost to thwart this scheme, take 2 indirect damage." */
const CAT_COST = stubAbility("cat.constant", {
  trigger: { kind: "constant", rules: [{ kind: "additionalThwartCost", scheme: { self: true }, indirectDamage: 2 }] },
  effects: [],
});
const CAT = stubSideScheme({ id: "cat", startingThreat: 6, abilities: [CAT_COST.ref] });

/** "Forced Interrupt: when your hero would take damage, prevent 1 of that damage." */
const WARDEN_INTERRUPT = stubAbility("warden.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "dealDamage", targetIs: { categories: ["identity"] } } },
  effects: [{ kind: "preventDamage", amount: { kind: "const", value: 1 } }],
});
const WARDEN = stubSupport({ id: "warden", cost: 0, abilities: [WARDEN_INTERRUPT.ref] });

/** Wasp's shape for thwarts: "your hero may divide their basic thwart among any number of schemes". */
const SPLITTER_RULE = stubAbility("splitter.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "divideBasicPower", power: "thwart", target: { categories: ["identity"], controller: "you" } }],
  },
  effects: [],
});
const SPLITTER = stubSupport({ id: "splitter", cost: 0, abilities: [SPLITTER_RULE.ref] });

/** Cost 1. "(thwart): Remove 1 threat from a side scheme." */
const PRICEY_ACTION = stubAbility("pricey.action", {
  trigger: { kind: "action" },
  label: ["thwart"],
  effects: [
    { kind: "chooseTarget", slot: "scheme", query: { categories: ["sideScheme"] }, chooser: { kind: "controller" } },
    { kind: "thwart", target: { kind: "slot", slot: "scheme" }, amount: { kind: "const", value: 1 } },
  ] as EffectSpec[],
});
const PRICEY = stubEvent({ id: "pricey", cost: 1, abilities: [PRICEY_ACTION.ref] });

/** An ally with THW 2 and 1 consequential damage under it. */
const SIDEKICK = stubAlly({ id: "sidekick", cost: 0, atk: 1, thw: 2, hp: 3, consequentialThwart: 1 });

const deps: EngineDeps = depsOf(
  MONSTER_COST,
  GENERATOR_RESOURCE,
  PROBE_ACTION,
  CAT_COST,
  WARDEN_INTERRUPT,
  SPLITTER_RULE,
  PRICEY_ACTION,
);

/**
 * P1 in hero form with an empty hand and 5 threat on the main scheme; each of `schemes` in the villain area with 6
 * threat.
 */
function startWith(...schemes: readonly (typeof MONSTER)[]): {
  readonly state: GameState;
  readonly schemes: readonly InstanceId[];
} {
  const state = gameAtFirstTurn({
    cards: [MONSTER, CAT, SPARK, DUD, GENERATOR, PROBE, WARDEN, SPLITTER, PRICEY, SIDEKICK],
    deps,
    encounter: [MONSTER.id, MONSTER.id, CAT.id],
    deck: [...copiesOf(SPARK.id, 2), DUD.id, GENERATOR.id, PROBE.id, WARDEN.id, SPLITTER.id, PRICEY.id, SIDEKICK.id],
  });
  const main = state.mainScheme.instanceId;
  let placed: GameState = {
    ...state,
    instances: { ...state.instances, [main]: { ...mustInstance(state, main), threat: 5 } },
    players: state.players.map((p) => ({
      ...p,
      identity: { ...p.identity, form: "hero" as const },
      hand: [],
      deck: [...p.hand, ...p.deck],
    })),
  };
  const ids: InstanceId[] = [];
  for (const scheme of schemes) {
    const next = encounterCardInVillainArea(placed, scheme.id, 6);
    placed = next.state;
    ids.push(next.id);
  }
  return { state: placed, schemes: ids };
}

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

// ---------------------------------------------------------------------------------------------------------------------
// docs/phase7-wave5.md §4.1 Q27–Q30: follow-ups to Q18 (RRG 1.8 "Cost", p. 13; "Initiating Abilities", p. 24).
// ---------------------------------------------------------------------------------------------------------------------

const at = (ids: readonly InstanceId[], index: number): InstanceId => {
  const id = ids[index];
  if (!id) throw new Error(`no scheme ${index}`);
  return id;
};

const heroOf = (state: GameState): InstanceId => mustPlayer(state, P1).identity.instanceId;

function expectReplay(session: GameSession): void {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

const settled = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((e) => (e.type === "thwartCostSettled" ? [e.outcome] : []));

const thwartInitiated = (events: readonly GameEvent[]): boolean =>
  events.some((e) => e.type === "triggerEvent" && e.event.kind === "thwart" && e.phase === "initiated");

/** Answers a target choice with `target`, a `spendResources` prompt with everything (`pay`) or nothing. */
const aimAt =
  (target: InstanceId, pay: boolean) =>
  (s: GameState): readonly string[] => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "chooseTarget") {
      const option = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === target);
      if (option) return [option.optionId];
    }
    if (choice?.prompt.kind === "spendResources") return pay ? choice.options.map((o) => o.optionId) : [];
    return defaultPick(s);
  };

const play = (card: InstanceId, payment: readonly Payment[]): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment,
  attachToInstanceId: null,
});

/** The `playCard` entry for `card` in `legalActions`: legal (with its example command) or not. */
function playEntry(state: GameState, card: InstanceId) {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error(`not P1's turn: ${actions.kind}`);
  const legal = actions.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === card);
  return { legal: legal !== undefined, example: legal?.example };
}

describe("§4.1 Q27 an additional thwart cost is paid together with the thwart's own cost", () => {
  it("a basic thwart asks for it before exhausting; declining leaves the hero ready and nothing thwarted", () => {
    const { state: bare, schemes } = startWith(MONSTER);
    const monster = at(schemes, 0);
    const { state, id: spark } = giveCard(bare, P1, SPARK.id);
    const asked = applyCommand(state, basicThwart(state, monster), deps);
    if (!asked.ok) throw new Error(asked.error.message);
    expect(asked.state.pendingChoice?.prompt.kind).toBe("spendResources");
    expect(mustInstance(asked.state, heroOf(state)).exhausted).toBe(false);

    const { session, events } = driveSession(startSession(state), deps, [basicThwart(state, monster)]);
    expect(mustInstance(session.state, heroOf(state)).exhausted).toBe(false);
    expect(mustInstance(session.state, monster).threat).toBe(6);
    expect(mustPlayer(session.state, P1).hand).toContain(spark);
    expect(settled(events)).toEqual(["declined"]);
    expect(thwartInitiated(events)).toBe(false);
    expectReplay(session);
    // Nothing was spent on it: the hero may still thwart.
    const again = applyCommand(session.state, basicThwart(session.state, session.state.mainScheme.instanceId), deps);
    expect(again.ok).toBe(true);
  });

  it("paid, the hero exhausts and the thwart resolves without being asked again; replay deep-equal", () => {
    const { state: bare, schemes } = startWith(MONSTER);
    const monster = at(schemes, 0);
    const state = giveCard(bare, P1, SPARK.id).state;
    const { session, events } = driveSession(startSession(state), deps, [basicThwart(state, monster)], payAll);
    expect(mustInstance(session.state, heroOf(state)).exhausted).toBe(true);
    expect(mustInstance(session.state, monster).threat).toBe(4);
    expect(settled(events)).toEqual(["paid"]);
    expect(events.filter((e) => e.type === "thwartCostAsked")).toHaveLength(1);
    expectReplay(session);
  });

  it("a thwart effect is still asked as it resolves, and declining there cancels it (the fallback)", () => {
    const { state: bare, schemes } = startWith(MONSTER);
    const monster = at(schemes, 0);
    const withSpark = giveCard(bare, P1, SPARK.id).state;
    const { state, id: probe } = giveCard(withSpark, P1, PROBE.id);
    const { session } = driveSession(startSession(state), deps, [play(probe, [])], aimAt(monster, false));
    expect(mustInstance(session.state, monster).threat).toBe(6);
    expect(mustInstance(session.state, session.state.mainScheme.instanceId).threat).toBe(5);
    expect(mustPlayer(session.state, P1).discard).toContain(probe);
    expectReplay(session);
  });
});

describe("§4.1 Q28 a thwart event's payability is judged after its own cost is paid", () => {
  it("paid with the only [energy] card, it has no target left: refused at play, and legalActions agrees", () => {
    const { state: bare } = startWith(MONSTER);
    const { state: withSpark, id: spark } = giveCard(bare, P1, SPARK.id);
    const { state, id: pricey } = giveCard(withSpark, P1, PRICEY.id);
    const result = applyCommand(state, play(pricey, [{ fromHand: spark }]), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("no_valid_target");
    expect(playEntry(state, pricey).legal).toBe(false);
  });

  it("with a second [energy] card it is legal, pays with one and may choose the scheme; replay deep-equal", () => {
    const { state: bare, schemes } = startWith(MONSTER);
    const monster = at(schemes, 0);
    const first = giveCard(bare, P1, SPARK.id);
    const second = giveCard(first.state, P1, SPARK.id, [first.id]);
    const { state, id: pricey } = giveCard(second.state, P1, PRICEY.id);
    const entry = playEntry(state, pricey);
    expect(entry.legal).toBe(true);
    expect(entry.example?.type === "playCard" ? entry.example.payment : []).toHaveLength(1);
    const { session } = driveSession(
      startSession(state),
      deps,
      [play(pricey, [{ fromHand: first.id }])],
      aimAt(monster, true),
    );
    expect(mustInstance(session.state, monster).threat).toBe(5);
    expect(mustPlayer(session.state, P1).hand).not.toContain(second.id);
    expectReplay(session);
  });
});

describe("§4.1 Q29 a divided basic thwart must afford the total of its schemes' additional costs", () => {
  const divided = (state: GameState, a: InstanceId, b: InstanceId): Command => ({
    type: "basicThwart",
    playerId: P1,
    thwarterInstanceId: heroOf(state),
    schemeInstanceId: a,
    divide: [
      { targetInstanceId: a, amount: 1 },
      { targetInstanceId: b, amount: 1 },
    ],
  });

  it("one [energy] card pays for either scheme alone, not for both", () => {
    const { state: bare, schemes } = startWith(MONSTER, MONSTER);
    const withSplitter = playerCardIntoPlay(bare, SPLITTER.id).state;
    const state = giveCard(withSplitter, P1, SPARK.id).state;
    const result = applyCommand(state, divided(state, at(schemes, 0), at(schemes, 1)), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("no_valid_target");
    expect(applyCommand(state, basicThwart(state, at(schemes, 0)), deps).ok).toBe(true);
  });

  it("with two, the total is asked for once and both schemes are thwarted; replay deep-equal", () => {
    const { state: bare, schemes } = startWith(MONSTER, MONSTER);
    const withSplitter = playerCardIntoPlay(bare, SPLITTER.id).state;
    const first = giveCard(withSplitter, P1, SPARK.id);
    const state = giveCard(first.state, P1, SPARK.id, [first.id]).state;
    let prompts = 0;
    const pick = (s: GameState): readonly string[] => {
      if (s.pendingChoice?.prompt.kind === "spendResources") prompts += 1;
      return payAll(s);
    };
    const { session, events } = driveSession(
      startSession(state),
      deps,
      [divided(state, at(schemes, 0), at(schemes, 1))],
      pick,
    );
    expect(prompts).toBe(1);
    expect(mustInstance(session.state, at(schemes, 0)).threat).toBe(5);
    expect(mustInstance(session.state, at(schemes, 1)).threat).toBe(5);
    expect(mustPlayer(session.state, P1).hand).toHaveLength(0);
    expect(settled(events)).toEqual(["paid"]);
    expectReplay(session);
  });
});

describe("§4.1 Q30 a 'take damage' thwart cost that is partly prevented was not paid", () => {
  it("a basic thwart: the hero takes 1 of 2, and neither exhausts nor thwarts; replay deep-equal", () => {
    const { state: bare, schemes } = startWith(CAT);
    const cat = at(schemes, 0);
    const state = playerCardIntoPlay(bare, WARDEN.id).state;
    const { session, events } = driveSession(startSession(state), deps, [basicThwart(state, cat)]);
    expect(mustInstance(session.state, heroOf(state)).damage).toBe(1);
    expect(mustInstance(session.state, heroOf(state)).exhausted).toBe(false);
    expect(mustInstance(session.state, cat).threat).toBe(6);
    expect(settled(events)).toEqual(["damageNotTaken"]);
    expect(thwartInitiated(events)).toBe(false);
    expectReplay(session);
  });

  it("a thwart effect: the thwart is cancelled (the fallback); replay deep-equal", () => {
    const { state: bare, schemes } = startWith(CAT);
    const cat = at(schemes, 0);
    const withWarden = playerCardIntoPlay(bare, WARDEN.id).state;
    const { state, id: probe } = giveCard(withWarden, P1, PROBE.id);
    const { session } = driveSession(startSession(state), deps, [play(probe, [])], aimAt(cat, true));
    expect(mustInstance(session.state, heroOf(state)).damage).toBe(1);
    expect(mustInstance(session.state, cat).threat).toBe(6);
    expect(mustInstance(session.state, session.state.mainScheme.instanceId).threat).toBe(5);
    expectReplay(session);
  });

  it("unprevented, all 2 are taken and the thwart goes ahead", () => {
    const { state, schemes } = startWith(CAT);
    const cat = at(schemes, 0);
    const { session, events } = driveSession(startSession(state), deps, [basicThwart(state, cat)]);
    expect(mustInstance(session.state, heroOf(state)).damage).toBe(2);
    expect(mustInstance(session.state, heroOf(state)).exhausted).toBe(true);
    expect(mustInstance(session.state, cat).threat).toBe(4);
    expect(settled(events)).toEqual(["paid"]);
  });

  it("a hero with 1 hit point left cannot take all 2, so the scheme is not a legal target", () => {
    const { state: bare, schemes } = startWith(CAT);
    const cat = at(schemes, 0);
    const hero = heroOf(bare);
    const state = { ...bare, instances: { ...bare.instances, [hero]: { ...mustInstance(bare, hero), damage: 9 } } };
    const result = applyCommand(state, basicThwart(state, cat), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("no_valid_target");
    expect(heroThwart(state).targets).not.toContain(cat);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// docs/phase7-wave5.md §4.1 Q40: a confused thwarter still pays the scheme's additional thwart cost. RRG 1.8 "Confuse,
// Confused" (p. 13): "Costs associated with the thwart attempt, including exhausting the character, must still be paid."
// ---------------------------------------------------------------------------------------------------------------------

describe("§4.1 Q40 a confused thwarter still pays the scheme's additional thwart cost", () => {
  const confuse = (state: GameState, id: InstanceId): GameState => {
    const instance = mustInstance(state, id);
    return {
      ...state,
      instances: { ...state.instances, [id]: { ...instance, statuses: { ...instance.statuses, confused: 1 } } },
    };
  };
  const confusedRemoved = (events: readonly GameEvent[], id: InstanceId): boolean =>
    events.some((e) => e.type === "statusRemoved" && e.instanceId === id && e.status === "confused");

  it("a confused hero is asked before exhausting, pays, exhausts, and the confused card replaces the thwart; replay deep-equal", () => {
    const { state: bare, schemes } = startWith(MONSTER);
    const monster = at(schemes, 0);
    const given = giveCard(bare, P1, SPARK.id);
    const state = confuse(given.state, heroOf(bare));
    const asked = applyCommand(state, basicThwart(state, monster), deps);
    if (!asked.ok) throw new Error(asked.error.message);
    expect(asked.state.pendingChoice?.prompt.kind).toBe("spendResources");
    expect(mustInstance(asked.state, heroOf(state)).exhausted).toBe(false);
    expect(mustInstance(asked.state, heroOf(state)).statuses.confused).toBe(1);

    const { session, events } = driveSession(startSession(state), deps, [basicThwart(state, monster)], payAll);
    expect(mustPlayer(session.state, P1).hand).not.toContain(given.id);
    expect(mustInstance(session.state, heroOf(state)).exhausted).toBe(true);
    expect(mustInstance(session.state, heroOf(state)).statuses.confused).toBe(0);
    expect(confusedRemoved(events, heroOf(state))).toBe(true);
    expect(mustInstance(session.state, monster).threat).toBe(6);
    expect(settled(events)).toEqual(["paid"]);
    expect(thwartInitiated(events)).toBe(false);
    expectReplay(session);
  });

  it("declined (Q27), nothing happens: the hero stays ready and confused, the card stays in hand; replay deep-equal", () => {
    const { state: bare, schemes } = startWith(MONSTER);
    const monster = at(schemes, 0);
    const given = giveCard(bare, P1, SPARK.id);
    const state = confuse(given.state, heroOf(bare));
    const { session, events } = driveSession(startSession(state), deps, [basicThwart(state, monster)]);
    expect(mustPlayer(session.state, P1).hand).toContain(given.id);
    expect(mustInstance(session.state, heroOf(state)).exhausted).toBe(false);
    expect(mustInstance(session.state, heroOf(state)).statuses.confused).toBe(1);
    expect(confusedRemoved(events, heroOf(state))).toBe(false);
    expect(settled(events)).toEqual(["declined"]);
    expectReplay(session);
  });

  it("a confused hero who cannot pay cannot target the scheme (Q18), and legalActions agrees; the main scheme still can", () => {
    const { state: bare, schemes } = startWith(MONSTER);
    const monster = at(schemes, 0);
    const state = confuse(giveCard(bare, P1, DUD.id).state, heroOf(bare));
    const result = applyCommand(state, basicThwart(state, monster), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("no_valid_target");
    const { targets } = heroThwart(state);
    expect(targets).not.toContain(monster);
    expect(targets).toContain(state.mainScheme.instanceId);
  });

  it("a confused hero pays a take-damage cost too before the confused card replaces the thwart", () => {
    const { state: bare, schemes } = startWith(CAT);
    const cat = at(schemes, 0);
    const state = confuse(bare, heroOf(bare));
    const { session, events } = driveSession(startSession(state), deps, [basicThwart(state, cat)]);
    expect(mustInstance(session.state, heroOf(state)).damage).toBe(2);
    expect(mustInstance(session.state, heroOf(state)).exhausted).toBe(true);
    expect(mustInstance(session.state, heroOf(state)).statuses.confused).toBe(0);
    expect(mustInstance(session.state, cat).threat).toBe(6);
    expect(settled(events)).toEqual(["paid"]);
    expectReplay(session);
  });

  it("a confused ally pays, exhausts and loses its confused card, and takes no consequential damage; replay deep-equal", () => {
    const { state: bare, schemes } = startWith(MONSTER);
    const monster = at(schemes, 0);
    const withAlly = playerCardIntoPlay(bare, SIDEKICK.id);
    const given = giveCard(withAlly.state, P1, SPARK.id);
    const ally = withAlly.id;
    const state = confuse(given.state, ally);
    const command: Command = { type: "basicThwart", playerId: P1, thwarterInstanceId: ally, schemeInstanceId: monster };
    const { session, events } = driveSession(startSession(state), deps, [command], payAll);
    expect(mustPlayer(session.state, P1).hand).not.toContain(given.id);
    expect(mustInstance(session.state, ally).exhausted).toBe(true);
    expect(mustInstance(session.state, ally).statuses.confused).toBe(0);
    expect(mustInstance(session.state, ally).damage).toBe(0);
    expect(mustInstance(session.state, monster).threat).toBe(6);
    expect(settled(events)).toEqual(["paid"]);
    expectReplay(session);
  });

  // Open (reported, not decided here): RRG 1.8 "Labeled Ability" (p. 26) cancels a confused identity's "(thwart)"
  // ability entirely as it is triggered, before it chooses a scheme, so there is no scheme whose additional cost the
  // resolution-time fallback could ask for. As built, only the event's own cost is paid (Q41) and nothing is asked.
  it("as built: a confused identity's (thwart) event is cancelled before choosing a target, so nothing is asked", () => {
    const { state: bare, schemes } = startWith(MONSTER);
    const monster = at(schemes, 0);
    const withSpark = giveCard(bare, P1, SPARK.id);
    const { state: withProbe, id: probe } = giveCard(withSpark.state, P1, PROBE.id);
    const state = confuse(withProbe, heroOf(bare));
    const { session, events } = driveSession(startSession(state), deps, [play(probe, [])], aimAt(monster, true));
    expect(events.some((e) => e.type === "thwartCostAsked")).toBe(false);
    expect(mustPlayer(session.state, P1).hand).toContain(withSpark.id);
    expect(mustPlayer(session.state, P1).discard).toContain(probe);
    expect(mustInstance(session.state, heroOf(state)).statuses.confused).toBe(0);
    expect(mustInstance(session.state, monster).threat).toBe(6);
    expectReplay(session);
  });
});
