/**
 * Rules QA of 2026-10-13 (docs/qa-wave10-engine-rules.md, findings S2, S3, S4, M2, questions Q-C and Q-E): what can
 * affect nothing right now is judged inside a branch and an option as it is at the top of an ability.
 *
 * RRG 1.8 "Target" (p. 42): "If an ability or game function requires one or more targets, that ability or game function
 * can only be initiated if it has at least one valid target", a target being valid "if any part of that ability can
 * affect that target"; a scheme with no threat is no target for a removal of threat (`threat-removal-target.test.ts`).
 * "Choose (Option)" (p. 12): "When a player card requires a player to choose an option, they cannot choose an option
 * that cannot be at least partially resolved. This includes options that … Require one or more targets and there are
 * no valid targets." "Cost" (p. 13): "An ability's cost cannot be paid if that ability's effect requires one or more
 * targets and there is not at least one valid target."
 *
 * Owner answers 57A ("from each scheme" with no threat anywhere: refused), 58A (a part that needs no target keeps a
 * removal playable, whatever its condition on how the card was paid for) and 59A (the branch that would run is the
 * one judged), all 2026-10-13. Synthetic cards only.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, Predicate, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const n = (value: number): ValueSpec => ({ kind: "const", value });
const you = { kind: "controller" } as const;
const slot = (name: string): TargetRef => ({ kind: "slot", slot: name });
const mainScheme: TargetRef = { kind: "mainScheme" };
const eachScheme: TargetRef = { kind: "each", query: { categories: ["scheme"] } };
const aScheme: EffectSpec = { kind: "chooseTarget", slot: "scheme", query: { categories: ["scheme"] }, chooser: you };
const anEnemy: EffectSpec = { kind: "chooseTarget", slot: "enemy", query: { categories: ["enemy"] }, chooser: you };
const draw: EffectSpec = { kind: "draw", player: you, amount: n(1) };
const thwart = (amount: number, target: TargetRef): EffectSpec => ({ kind: "thwart", target, amount: n(amount) });
const remove = (amount: number, target: TargetRef): EffectSpec => ({ kind: "removeThreat", target, amount: n(amount) });
/** The game starts in alter-ego form: a condition that holds now, and one that does not. */
const HOLDS: Predicate = { kind: "form", player: you, form: "alterEgo" };
const FAILS: Predicate = { kind: "form", player: you, form: "hero" };
const PAID_MENTAL: Predicate = { kind: "paidWith", resource: "mental" };

const abilities: ReturnType<typeof stubAbility>[] = [];
const event = (id: string, label: "thwart" | null, effects: readonly EffectSpec[], costEffects?: number) => {
  const definition: AbilityDefinition = {
    trigger: { kind: "action" },
    ...(label ? { label: [label] as const } : {}),
    effects,
    ...(costEffects !== undefined ? { costEffects } : {}),
  };
  const ability = stubAbility(`${id}.action`, definition);
  abilities.push(ability);
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const support = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, cost: { exhaustSelf: true }, effects });
  abilities.push(ability);
  return { card: stubSupport({ id, cost: 1, abilities: [ability.ref] }), ability };
};

// -- S2: a removal inside a branch, or one a rider modifies ------------------------------------------------------------------

/** "(thwart): Remove 1 threat from a scheme (from each scheme instead if …)", each shape in a branch. */
const helmet = (id: string, condition: Predicate) =>
  event(id, "thwart", [
    { kind: "if", condition, then: [thwart(1, eachScheme)], otherwise: [aScheme, thwart(1, slot("scheme"))] },
  ]);
const HELMET_EACH = helmet("helmet-each", HOLDS);
const HELMET_ONE = helmet("helmet-one", FAILS);
/** "(thwart): Remove 6 threat from the main scheme (ignoring the crisis icon if you paid with a [mental] resource)." */
const AVERTED = event("averted", "thwart", [
  {
    kind: "if",
    condition: PAID_MENTAL,
    then: [{ kind: "thwart", target: mainScheme, amount: n(6), ignoreCrisis: true }],
    otherwise: [thwart(6, mainScheme)],
  },
]);
/** "(thwart): Remove 3 threat from the main scheme. If …, return this card to your hand." */
const IMPEDE = event("impede", "thwart", [
  remove(3, mainScheme),
  {
    kind: "if",
    condition: HOLDS,
    then: [{ kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "hand" }],
  },
]);
/** "Remove 1 threat from the main scheme. If [a condition on the game], draw 1 card." */
const rider = (id: string, condition: Predicate) =>
  event(id, null, [remove(1, mainScheme), { kind: "if", condition, then: [draw] }]);
const RIDER_HOLDS = rider("rider-holds", HOLDS);
const RIDER_FAILS = rider("rider-fails", FAILS);
/** Question 58: "(thwart): Remove 3 threat from a scheme. If you paid for this card with a [mental] resource, draw 1 card." */
const PAID_RIDER = event("paid-rider", "thwart", [
  aScheme,
  thwart(3, slot("scheme")),
  { kind: "if", condition: PAID_MENTAL, then: [draw] },
]);

// -- M2: a part of its own inside the branch that holds the removal -------------------------------------------------------------

/** "(thwart): Draw 1 card and remove 4 threat from a scheme", both in each branch (Photon Speed's shape). */
const SHIFT = event("shift", "thwart", [
  aScheme,
  {
    kind: "if",
    condition: HOLDS,
    then: [draw, { kind: "thwart", target: slot("scheme"), amount: n(4), ignoreCrisis: true }],
    otherwise: [draw, thwart(4, slot("scheme"))],
  },
]);

// -- Question 57: "from each scheme" -------------------------------------------------------------------------------------------

/** "Exhaust → remove 1 threat from each scheme." */
const EACH = support("each", [remove(1, eachScheme)]);
/** "Exhaust → remove 1 threat from each scheme. If …, remove 1 threat from the main scheme." */
const eachAndMore = (id: string, condition: Predicate) =>
  support(id, [remove(1, eachScheme), { kind: "if", condition, then: [remove(1, mainScheme)] }]);
const EACH_MORE_HOLDS = eachAndMore("each-more-holds", HOLDS);
const EACH_MORE_FAILS = eachAndMore("each-more-fails", FAILS);

// -- S4: the options of a "choose one" -----------------------------------------------------------------------------------------

const DAMAGE = {
  label: "Deal 1 damage to an enemy",
  effects: [anEnemy, { kind: "dealDamage", target: slot("enemy"), amount: n(1) }],
} as const;
const THREAT = { label: "Remove 2 threat from a scheme", effects: [aScheme, remove(2, slot("scheme"))] } as const;
const NAMED = { label: "Remove 1 threat from the main scheme", effects: [remove(1, mainScheme)] } as const;
const DRAW = { label: "Draw 1 card", effects: [draw] } as const;
const chooseOne = (
  ...options: readonly { readonly label: string; readonly effects: readonly EffectSpec[] }[]
): EffectSpec => ({
  kind: "chooseOne",
  chooser: you,
  options,
});
/** "Exhaust → choose one: deal 1 damage to an enemy / remove 2 threat from a scheme / draw 1 card." */
const GUN = support("gun", [chooseOne(DAMAGE, THREAT, DRAW)]);
/** "Exhaust → choose one: remove 2 threat from a scheme / remove 1 threat from the main scheme." */
const THREAT_ONLY = support("threat-only", [chooseOne(THREAT, NAMED)]);
/** "Exhaust → draw 1 card. Choose one: remove 2 threat from a scheme / remove 1 threat from the main scheme." */
const DRAW_THEN_CHOOSE = support("draw-then-choose", [draw, chooseOne(THREAT, NAMED)]);
/** "Choose two of the following (you may choose the same option twice)", the draw aside. */
const TWICE = support("twice", [
  draw,
  { kind: "chooseOne", chooser: you, options: [DAMAGE, THREAT], count: 2, allowRepeat: true },
]);
const TWICE_THREAT = support("twice-threat", [
  draw,
  { kind: "chooseOne", chooser: you, options: [THREAT], count: 2, allowRepeat: true },
]);

// -- S3: a printed cost scripted as leading effects -------------------------------------------------------------------------------

/** "(thwart): Draw 1 card → remove 3 threat from the main scheme", the cost written as the first effect. */
const COST_MARKED = event("cost-marked", "thwart", [draw, remove(3, mainScheme)], 1);
/** The same effects with no cost among them: "Draw 1 card. Remove 3 threat from the main scheme." */
const COST_UNMARKED = event("cost-unmarked", "thwart", [draw, remove(3, mainScheme)]);
/** "(thwart): Draw 1 card → remove 3 threat from a scheme." */
const COST_CHOSEN = event("cost-chosen", "thwart", [draw, aScheme, thwart(3, slot("scheme"))], 1);

const EVENTS = [
  HELMET_EACH,
  HELMET_ONE,
  AVERTED,
  IMPEDE,
  RIDER_HOLDS,
  RIDER_FAILS,
  PAID_RIDER,
  SHIFT,
  COST_MARKED,
  COST_UNMARKED,
  COST_CHOSEN,
];
const SUPPORTS = [EACH, EACH_MORE_HOLDS, EACH_MORE_FAILS, GUN, THREAT_ONLY, DRAW_THEN_CHOOSE, TWICE, TWICE_THREAT];
const PLOT = stubSideScheme({ id: "plot", startingThreat: 3, boostIcons: 0 });
const deps: EngineDeps = depsOf(...abilities);

const mainOf = (state: GameState): InstanceId => state.mainScheme!.instanceId;
const withThreat = (state: GameState, id: InstanceId, threat: number): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), threat } },
});
/** The first turn (alter-ego form), with the main scheme holding `threat`. */
function table(threat: number): GameState {
  const state = gameAtFirstTurn({
    cards: [PLOT, ...EVENTS.map((e) => e.card), ...SUPPORTS.map((s) => s.card)],
    deps,
    encounter: [PLOT.id],
    deck: [...EVENTS, ...SUPPORTS].map((e) => e.card.id),
  });
  return withThreat(state, mainOf(state), threat);
}
const playCommand = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
type Carded = { readonly card: { readonly id: CardId }; readonly ability: ReturnType<typeof stubAbility> };
/** The code playing `card` now is refused with, or null when the play is accepted. */
function refusal(state: GameState, card: Carded): string | null {
  const given = giveCard(state, P1, card.card.id);
  const result = applyCommand(given.state, playCommand(given.id), deps);
  return result.ok ? null : result.error.code;
}
/** Whether `legalActions` offers playing `card`. */
function offered(state: GameState, card: Carded): boolean {
  const given = giveCard(state, P1, card.card.id);
  const actions = legalActions(given.state, P1, deps);
  if (actions.kind !== "turn") throw new Error(`expected the player's turn, got ${actions.kind}`);
  return actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === given.id);
}
/** Runs `command`, answering each choice with the default pick, and reports the labels each option choice offered. */
function drive(state: GameState, command: Command) {
  const options: string[][] = [];
  const targets: string[] = [];
  const run = runCommandsPicking(
    state,
    deps,
    (current) => {
      const choice = current.pendingChoice;
      if (choice?.prompt.kind === "chooseOption") options.push(choice.options.map((o) => o.label));
      if (choice?.prompt.kind === "chooseTarget") targets.push(choice.prompt.slot);
      return defaultPick(current);
    },
    command,
  );
  return { ...run, options, targets };
}
const play = (state: GameState, card: Carded) => {
  const given = giveCard(state, P1, card.card.id);
  return { ...drive(given.state, playCommand(given.id)), id: given.id, before: given.state };
};
/** The support in play and the command that uses its action. */
function inPlay(state: GameState, card: Carded) {
  const placed = playerCardIntoPlay(state, card.card.id);
  const use: Command = {
    type: "useAbility",
    playerId: P1,
    cardInstanceId: placed.id,
    abilityId: card.ability.ref.id,
    payment: [],
  };
  return { ...placed, use };
}
/** The code using the support's action is refused with (null when accepted), and whether it stayed ready. */
function useRefusal(state: GameState, card: Carded) {
  const placed = inPlay(state, card);
  const result = applyCommand(placed.state, placed.use, deps);
  return { code: result.ok ? null : result.error.code, ready: !mustInstance(placed.state, placed.id).exhausted };
}
const count = (events: readonly GameEvent[], type: GameEvent["type"]): number =>
  events.filter((e) => e.type === type).length;
const hand = (state: GameState): number => mustPlayer(state, P1).hand.length;
const REFUSED = "no_valid_target";

describe("S2: a removal of threat inside a branch is judged by the branch that would run (owner question 59, default A)", () => {
  it("'remove 1 threat from a scheme (from each scheme instead if …)': refused with no threat anywhere, whichever branch would run", () => {
    for (const card of [HELMET_EACH, HELMET_ONE]) {
      expect(refusal(table(0), card), card.card.id).toBe(REFUSED);
      expect(offered(table(0), card), card.card.id).toBe(false);
      expect(offered(table(2), card), card.card.id).toBe(true);
      const { state } = play(table(2), card);
      expect(mustInstance(state, mainOf(state)).threat).toBe(1);
    }
  });

  it("only the branch that would run is judged: threat on a side scheme alone serves 'a scheme' and 'each scheme'", () => {
    const plot = encounterCardInVillainArea(table(0), PLOT.id, 3);
    for (const card of [HELMET_EACH, HELMET_ONE]) {
      const { state } = play(plot.state, card);
      expect(mustInstance(state, plot.id).threat, card.card.id).toBe(2);
    }
  });

  it("a branch that depends on how the card was paid for is a removal when both branches are", () => {
    expect(refusal(table(0), AVERTED)).toBe(REFUSED);
    expect(offered(table(0), AVERTED)).toBe(false);
    const { state } = play(table(8), AVERTED);
    expect(mustInstance(state, mainOf(state)).threat).toBe(2);
  });

  it("the card's own return to hand is no part of its own: refused with no threat, though its condition holds", () => {
    expect(refusal(table(0), IMPEDE)).toBe(REFUSED);
    const played = play(table(4), IMPEDE);
    expect(mustInstance(played.state, mainOf(played.state)).threat).toBe(1);
    expect(mustPlayer(played.state, P1).hand).toContain(played.id);
  });

  it("a rider on the game as it stands: a part of its own while its condition holds, no part while it does not", () => {
    expect(refusal(table(0), RIDER_FAILS)).toBe(REFUSED);
    expect(offered(table(1), RIDER_FAILS)).toBe(true);
    const played = play(table(0), RIDER_HOLDS);
    expect(count(played.events, "threatRemoved")).toBe(0);
    // The event left the hand and one card was drawn.
    expect(hand(played.state)).toBe(hand(played.before));
  });

  it("question 58 (A): a rider on how the card was paid for keeps a removal playable with no threat anywhere", () => {
    expect(offered(table(0), PAID_RIDER)).toBe(true);
    const played = play(table(0), PAID_RIDER);
    expect(played.targets).toEqual([]);
    expect(count(played.events, "threatRemoved")).toBe(0);
    expect(played.state.pendingChoice).toBeNull();
  });
});

describe("M2: a part of its own inside the branch that holds the removal keeps the card playable", () => {
  it("'draw 1 card and remove 4 threat from a scheme', branched: played with no threat anywhere; the card is drawn, no scheme chosen", () => {
    expect(offered(table(0), SHIFT)).toBe(true);
    const played = play(table(0), SHIFT);
    expect(played.targets).toEqual([]);
    expect(count(played.events, "threatRemoved")).toBe(0);
    expect(hand(played.state)).toBe(hand(played.before));
    const loaded = play(table(5), SHIFT);
    expect(mustInstance(loaded.state, mainOf(loaded.state)).threat).toBe(1);
  });
});

describe("owner answer 57A (2026-10-13): 'remove threat from each scheme' with no threat on any scheme is refused, in every shape", () => {
  it("alone, and with a conditional removal after it, whether or not that condition holds: refused, nothing exhausted", () => {
    for (const card of [EACH, EACH_MORE_HOLDS, EACH_MORE_FAILS]) {
      expect(useRefusal(table(0), card), card.card.id).toEqual({ code: REFUSED, ready: true });
      const placed = inPlay(table(3), card);
      const { state } = drive(placed.state, placed.use);
      expect(mustInstance(state, placed.id).exhausted, card.card.id).toBe(true);
      expect(mustInstance(state, mainOf(state)).threat, card.card.id).toBe(card === EACH_MORE_HOLDS ? 1 : 2);
    }
  });

  it("threat on one scheme is enough: the others are skipped as it resolves", () => {
    const plot = encounterCardInVillainArea(table(0), PLOT.id, 3);
    const placed = inPlay(plot.state, EACH);
    const { state } = drive(placed.state, placed.use);
    expect(mustInstance(state, plot.id).threat).toBe(2);
    expect(mustInstance(state, mainOf(state)).threat).toBe(0);
  });
});

describe("S4: an option that requires a target and has none is not offered (RRG 1.8 'Choose (Option)', p. 12)", () => {
  it("'remove 2 threat from a scheme' is offered with threat on a scheme, and not with none", () => {
    const loaded = inPlay(table(3), GUN);
    expect(drive(loaded.state, loaded.use).options).toEqual([[DAMAGE.label, THREAT.label, DRAW.label]]);
    const empty = inPlay(table(0), GUN);
    const run = drive(empty.state, empty.use);
    expect(run.options).toEqual([[DAMAGE.label, DRAW.label]]);
    expect(count(run.events, "threatRemoved")).toBe(0);
  });

  it("the answer is checked against what was offered: the hidden option cannot be sent", () => {
    const empty = inPlay(table(0), GUN);
    const asked = applyCommand(empty.state, empty.use, deps);
    if (!asked.ok) throw new Error(asked.error.message);
    const choice = asked.state.pendingChoice!;
    expect(choice.options.map((o) => o.optionId)).toEqual(["0", "2"]);
    const sent = applyCommand(
      asked.state,
      { type: "resolveChoice", playerId: P1, choiceId: choice.choiceId, selectedOptionIds: ["1"] },
      deps,
    );
    expect(sent.ok).toBe(false);
  });

  it("every option unavailable: the ability cannot be initiated and its cost is not paid", () => {
    expect(useRefusal(table(0), THREAT_ONLY)).toEqual({ code: REFUSED, ready: true });
    const loaded = inPlay(table(3), THREAT_ONLY);
    expect(drive(loaded.state, loaded.use).options).toEqual([[THREAT.label, NAMED.label]]);
  });

  it("with another part of its own the ability initiates, and a choice with no option left resolves to nothing", () => {
    const empty = inPlay(table(0), DRAW_THEN_CHOOSE);
    const run = drive(empty.state, empty.use);
    expect(run.options).toEqual([]);
    expect(run.state.pendingChoice).toBeNull();
    expect(hand(run.state)).toBe(hand(empty.state) + 1);
  });

  it("'choose two, the same option twice allowed': the removal is offered neither time, and no choice is opened with no option left", () => {
    const both = inPlay(table(0), TWICE);
    expect(drive(both.state, both.use).options).toEqual([[DAMAGE.label, DAMAGE.label]]);
    const loaded = inPlay(table(4), TWICE);
    expect(drive(loaded.state, loaded.use).options).toEqual([[DAMAGE.label, DAMAGE.label, THREAT.label, THREAT.label]]);
    const none = inPlay(table(0), TWICE_THREAT);
    const run = drive(none.state, none.use);
    expect(run.options).toEqual([]);
    expect(run.state.pendingChoice).toBeNull();
  });
});

describe("S3: a printed cost scripted as leading effects is no part of the effect (RRG 1.8 'Cost', p. 13; `costEffects`)", () => {
  it("'draw 1 card → remove 3 threat from the main scheme' is refused with no threat there; unmarked, the draw is a part of its own", () => {
    expect(refusal(table(0), COST_MARKED)).toBe(REFUSED);
    expect(offered(table(0), COST_MARKED)).toBe(false);
    expect(offered(table(0), COST_UNMARKED)).toBe(true);
    const played = play(table(4), COST_MARKED);
    expect(mustInstance(played.state, mainOf(played.state)).threat).toBe(1);
    expect(hand(played.state)).toBe(hand(played.before));
  });

  it("'draw 1 card → remove 3 threat from a scheme': the choice after the cost is read as the effect's opening choice", () => {
    expect(refusal(table(0), COST_CHOSEN)).toBe(REFUSED);
    const plot = encounterCardInVillainArea(table(0), PLOT.id, 3);
    const played = play(plot.state, COST_CHOSEN);
    expect(played.state.villainArea).not.toContain(plot.id);
  });
});
