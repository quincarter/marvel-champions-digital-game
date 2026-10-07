/**
 * A move of threat needs a source its threat can leave (owner ruling 2026-10-06, docs/phase7-wave7.md §4.1).
 *
 * RRG 1.8 "Move" (p. 30): "If there is no valid source or destination for a move, the move cannot be made", and "If
 * threat is moved off a scheme, the moved threat is considered to be removed from that scheme." So a scheme whose
 * threat cannot be removed (RRG 1.8 "Crisis Icon", p. 14; a "threat cannot be removed" rule) is no source, nor is a
 * scheme with no threat, and an ability whose move has no source cannot be initiated: it is not offered, and a command
 * for it is refused before any cost (RRG 1.8 "Cost", p. 13). A scheme holding less than the amount named is still a
 * source; the move takes what is there.
 *
 * Synthetic cards. The FFG answer the owner cites for the card this came from (Temporal Leap, `next_evol` 40013) is
 * not in this repo's rulings transcript.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import { TARGET_FAULT_MESSAGE } from "./resolve/target-validity.js";
import { evaluate } from "./select.js";
import type { EffectSpec, Predicate, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubAlly, stubMainScheme, stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";
import { choiceExclusions } from "./why-not.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const SELF: TargetRef = { kind: "self" };
const MAIN: TargetRef = { kind: "mainScheme" };
const you = { kind: "controller" } as const;
const chosen: TargetRef = { kind: "slot", slot: "scheme" };
const draw1: EffectSpec = { kind: "draw", player: you, amount: n(1) };
const aScheme: EffectSpec = { kind: "chooseTarget", slot: "scheme", chooser: you, query: { categories: ["scheme"] } };
const action = (id: string, def: Omit<AbilityDefinition, "trigger">): StubAbility =>
  stubAbility(id, { trigger: { kind: "action" }, ...def });
const constant = (id: string, ...rules: RuleSpec[]): StubAbility =>
  stubAbility(id, { trigger: { kind: "constant", rules }, effects: [] });

/**
 * Temporal Leap's shape: "Exhaust this card → [draw 1 card, standing for a printed cost scripted as an effect, and]
 * move 4 threat from the main scheme to here."
 */
const LEAP = action("leap.action", {
  cost: { exhaustSelf: true },
  effects: [draw1, { kind: "moveThreat", from: MAIN, to: SELF, amount: n(4) }],
});
/** Beat Cop's shape: "Action: Move 1 threat from a scheme to here." */
const BEAT = action("beat.action", {
  effects: [aScheme, { kind: "moveThreat", from: chosen, to: SELF, amount: n(1) }],
});
/** An ally's own "Action: Move 4 threat from the main scheme to here", with "this ally ignores the crisis icon". */
const RANGE = action("ranger.action", { effects: [{ kind: "moveThreat", from: MAIN, to: SELF, amount: n(4) }] });
const RANGE_IGNORES = constant("ranger.constant", {
  kind: "characterIgnores",
  target: { self: true },
  ignores: ["crisis"],
});
/** "Threat cannot be removed from the main scheme." */
const LOCKED = constant("lock.constant", { kind: "threatCannotBeRemoved", target: { categories: ["mainScheme"] } });
/**
 * Back to the Future's two threat lines (`next_evol` 40033), P1 standing for the Cable player: "The [P1] player cannot
 * remove threat from schemes other than this one. Other players cannot remove threat from this scheme."
 */
const P1_REF = { kind: "id", playerId: P1 } as const;
const BOUND = constant(
  "bttf.constant",
  { kind: "threatCannotBeRemoved", target: { categories: ["scheme"], self: false }, player: P1_REF },
  { kind: "threatCannotBeRemoved", target: { self: true }, player: { kind: "others", of: P1_REF } },
);

const LEAP_CARD = stubSupport({ id: "leap", cost: 0, abilities: [LEAP.ref] });
const BEAT_CARD = stubSupport({ id: "beat", cost: 0, abilities: [BEAT.ref] });
const RANGER = stubAlly({ id: "ranger", cost: 0, atk: 1, thw: 1, hp: 3, abilities: [RANGE.ref, RANGE_IGNORES.ref] });
const LOCK = stubSupport({ id: "lock", cost: 0, abilities: [LOCKED.ref] });
const MAIN_SCHEME = stubMainScheme({
  id: "long-scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(200), acceleration: flat(0) }],
});
const SIDE = stubSideScheme({ id: "side", startingThreat: 0, boostIcons: 0 });
const CRISIS = stubSideScheme({ id: "crisis-side", startingThreat: 0, icons: ["crisis"], boostIcons: 0 });
const BTTF = stubSideScheme({ id: "bttf", startingThreat: 0, boostIcons: 0, abilities: [BOUND.ref] });

const deps: EngineDeps = depsOf(LEAP, BEAT, RANGE, RANGE_IGNORES, LOCKED, BOUND);

interface Table {
  readonly state: GameState;
  readonly main: InstanceId;
}
/** P1's first turn, the main scheme holding `mainThreat`. */
function table(mainThreat: number, players: 1 | 2 = 1): Table {
  const base = gameAtFirstTurn({
    cards: [LEAP_CARD, BEAT_CARD, RANGER, LOCK, SIDE, CRISIS, BTTF],
    deps,
    mainScheme: MAIN_SCHEME,
    encounter: [SIDE.id, CRISIS.id, BTTF.id, ...copiesOf("treachery" as typeof SIDE.id, 20)],
    deck: [LEAP_CARD.id, BEAT_CARD.id, RANGER.id, LOCK.id],
    players,
  });
  const main = base.mainScheme.instanceId;
  return {
    main,
    state: { ...base, instances: { ...base.instances, [main]: { ...mustInstance(base, main), threat: mainThreat } } },
  };
}
const inPlay = (state: GameState, card: { readonly id: typeof SIDE.id }, player: PlayerId = P1) =>
  playerCardIntoPlay(state, card.id, player);
const scheme = (state: GameState, card: { readonly id: typeof SIDE.id }, threat: number) =>
  encounterCardInVillainArea(state, card.id, threat);
const threat = (state: GameState, id: InstanceId): number => mustInstance(state, id).threat;
const use = (card: InstanceId, ability: StubAbility, player: PlayerId = P1): Command => ({
  type: "useAbility",
  playerId: player,
  cardInstanceId: card,
  abilityId: ability.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
  payment: [],
});

/** How `legalActions` lists this ability for P1: among the legal actions, or illegal with the engine's explanation. */
function listing(state: GameState, card: InstanceId, ability: StubAbility) {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error("not P1's turn");
  const names = (a: { readonly action: { readonly kind: string } }): boolean =>
    a.action.kind === "useAbility" &&
    (a.action as { instanceId?: InstanceId }).instanceId === card &&
    (a.action as { abilityId?: string }).abilityId === ability.ref.id;
  const illegal = actions.illegal.find(names);
  return {
    legal: actions.legal.some(names),
    ...(illegal ? { reason: illegal.reason, message: illegal.message } : {}),
  };
}
const NO_SOURCE = { legal: false, reason: "no_valid_target", message: TARGET_FAULT_MESSAGE.moveSource };

/** The command for the ability is refused, and so nothing is spent: the engine returns no new state. */
function refused(state: GameState, card: InstanceId, ability: StubAbility, player: PlayerId = P1): void {
  const result = applyCommand(state, use(card, ability, player), deps);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.code).toBe("no_valid_target");
  expect(result.error.message).toBe(TARGET_FAULT_MESSAGE.moveSource);
  expect(mustInstance(state, card).exhausted).toBe(false);
}
/** Uses the ability, answering a scheme choice with `pick` when given; the schemes its prompt offered. */
function used(state: GameState, card: InstanceId, ability: StubAbility, pick?: InstanceId, player: PlayerId = P1) {
  const offered: string[] = [];
  const picker = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind !== "chooseTarget") return defaultPick(s);
    offered.push(...choice.options.map((o) => o.optionId));
    return [pick ?? choice.options[0]!.optionId];
  };
  const after = runCommandsPicking(state, deps, picker, use(card, ability, player)).state;
  return { state: after, offered };
}

describe("a named source: 'move 4 threat from the main scheme to here'", () => {
  it("the control: with nothing barring it the ability is listed, its cost is paid and 4 threat moves", () => {
    const at = table(6);
    const leap = inPlay(at.state, LEAP_CARD);
    expect(listing(leap.state, leap.id, LEAP)).toEqual({ legal: true });
    const hand = mustPlayer(leap.state, P1).hand.length;
    const after = used(leap.state, leap.id, LEAP).state;
    expect([threat(after, at.main), threat(after, leap.id)]).toEqual([2, 4]);
    expect(mustInstance(after, leap.id).exhausted).toBe(true);
    expect(mustPlayer(after, P1).hand).toHaveLength(hand + 1);
  });

  it("under a crisis icon it is not listed, says why, and its command is refused with nothing spent", () => {
    const at = table(6);
    const crisis = scheme(at.state, CRISIS, 0);
    const leap = inPlay(crisis.state, LEAP_CARD);
    expect(listing(leap.state, leap.id, LEAP)).toEqual(NO_SOURCE);
    refused(leap.state, leap.id, LEAP);
  });

  it("under a 'threat cannot be removed from the main scheme' rule it is not listed and is refused", () => {
    const at = table(6);
    const lock = inPlay(at.state, LOCK);
    const leap = inPlay(lock.state, LEAP_CARD);
    expect(listing(leap.state, leap.id, LEAP)).toEqual(NO_SOURCE);
    refused(leap.state, leap.id, LEAP);
  });

  it("Back to the Future: the bound player's is refused; another player's moves the threat", () => {
    const at = table(6, 2);
    const bttf = scheme(at.state, BTTF, 3);
    const mine = inPlay(bttf.state, LEAP_CARD, P1);
    const theirs = inPlay(mine.state, LEAP_CARD, P2);
    expect(listing(theirs.state, mine.id, LEAP)).toEqual(NO_SOURCE);
    refused(theirs.state, mine.id, LEAP);
    const after = used(theirs.state, theirs.id, LEAP, undefined, P2).state;
    expect([threat(after, at.main), threat(after, theirs.id), threat(after, mine.id)]).toEqual([2, 4, 0]);
  });

  it("a source that ignores the crisis icon moves the threat under one", () => {
    const at = table(6);
    const crisis = scheme(at.state, CRISIS, 0);
    const ranger = inPlay(crisis.state, RANGER);
    expect(listing(ranger.state, ranger.id, RANGE)).toEqual({ legal: true });
    const after = used(ranger.state, ranger.id, RANGE).state;
    expect([threat(after, at.main), threat(after, ranger.id)]).toEqual([2, 4]);
  });

  it("but a 'threat cannot be removed' rule still stops that source", () => {
    const at = table(6);
    const lock = inPlay(at.state, LOCK);
    const ranger = inPlay(lock.state, RANGER);
    expect(listing(ranger.state, ranger.id, RANGE)).toEqual(NO_SOURCE);
    refused(ranger.state, ranger.id, RANGE);
  });

  it("a main scheme with no threat is no source: not listed, refused", () => {
    const at = table(0);
    const leap = inPlay(at.state, LEAP_CARD);
    expect(listing(leap.state, leap.id, LEAP)).toEqual(NO_SOURCE);
    refused(leap.state, leap.id, LEAP);
  });

  it("a main scheme with less threat than the amount is a source: the move takes the 2 that are there", () => {
    const at = table(2);
    const leap = inPlay(at.state, LEAP_CARD);
    expect(listing(leap.state, leap.id, LEAP)).toEqual({ legal: true });
    const after = used(leap.state, leap.id, LEAP).state;
    expect([threat(after, at.main), threat(after, leap.id)]).toEqual([0, 2]);
    expect(mustInstance(after, leap.id).exhausted).toBe(true);
  });
});

describe("a chosen source: 'move 1 threat from a scheme to here'", () => {
  it("only schemes the threat can leave are offered: not the main scheme under a crisis icon, not one with none", () => {
    const at = table(6);
    const crisis = scheme(at.state, CRISIS, 0);
    const side = scheme(crisis.state, SIDE, 3);
    const beat = inPlay(side.state, BEAT_CARD);
    expect(listing(beat.state, beat.id, BEAT)).toEqual({ legal: true });
    const opened = applyCommand(beat.state, use(beat.id, BEAT), deps);
    if (!opened.ok) throw new Error(opened.error.message);
    expect(opened.state.pendingChoice?.options.map((o) => o.optionId)).toEqual([side.id]);
    // "Why not the others?": the main scheme is barred; the empty crisis scheme is not given a removal reason.
    expect(choiceExclusions(opened.state, deps).filter((x) => x.reason === "cannotRemoveThreat")).toEqual([
      { instanceId: at.main, reason: "cannotRemoveThreat" },
    ]);
    const after = used(beat.state, beat.id, BEAT).state;
    expect([threat(after, at.main), threat(after, side.id), threat(after, beat.id)]).toEqual([6, 2, 1]);
  });

  it("with the only threat on the main scheme under a crisis icon there is no source: not listed, refused", () => {
    const at = table(6);
    const crisis = scheme(at.state, CRISIS, 0);
    const beat = inPlay(crisis.state, BEAT_CARD);
    expect(listing(beat.state, beat.id, BEAT)).toEqual(NO_SOURCE);
    refused(beat.state, beat.id, BEAT);
  });

  it("with no bar in play a scheme with no threat is still not offered, and no scheme with threat means refused", () => {
    const at = table(6);
    const side = scheme(at.state, SIDE, 0);
    const beat = inPlay(side.state, BEAT_CARD);
    expect(used(beat.state, beat.id, BEAT).offered).toEqual([at.main]);
    const empty = table(0);
    const bare = inPlay(scheme(empty.state, SIDE, 0).state, BEAT_CARD);
    expect(listing(bare.state, bare.id, BEAT)).toEqual(NO_SOURCE);
    refused(bare.state, bare.id, BEAT);
  });

  it("Back to the Future: the bound player is offered only that scheme, another player every scheme but it", () => {
    const at = table(6, 2);
    const bttf = scheme(at.state, BTTF, 3);
    const mine = inPlay(bttf.state, BEAT_CARD, P1);
    const theirs = inPlay(mine.state, BEAT_CARD, P2);
    const p1 = used(theirs.state, mine.id, BEAT);
    expect(p1.offered).toEqual([bttf.id]);
    expect([threat(p1.state, bttf.id), threat(p1.state, mine.id)]).toEqual([2, 1]);
    const p2 = used(theirs.state, theirs.id, BEAT, undefined, P2);
    expect(p2.offered).toEqual([at.main]);
    expect([threat(p2.state, at.main), threat(p2.state, theirs.id)]).toEqual([5, 1]);
  });
});

describe("Predicate canRemoveThreatFrom", () => {
  const can = (state: GameState, source: InstanceId, scheme: TargetRef, ignoreCrisis = false): boolean => {
    const predicate: Predicate = {
      kind: "canRemoveThreatFrom",
      scheme,
      ...(ignoreCrisis ? { ignoreCrisis: true } : {}),
    };
    return evaluate(state, predicate, { selfInstanceId: source, controllerId: P1, event: null, bindings: {}, deps });
  };
  const EACH_SCHEME: TargetRef = { kind: "each", query: { categories: ["scheme"], hasThreat: true } };

  it("true with nothing barring; false for the main scheme under a crisis icon, unless the removal ignores it", () => {
    const at = table(6);
    const free = inPlay(at.state, LEAP_CARD);
    expect(can(free.state, free.id, MAIN)).toBe(true);
    const crisis = scheme(at.state, CRISIS, 0);
    const leap = inPlay(crisis.state, LEAP_CARD);
    expect(can(leap.state, leap.id, MAIN)).toBe(false);
    expect(can(leap.state, leap.id, MAIN, true)).toBe(true);
    expect(can(leap.state, leap.id, EACH_SCHEME)).toBe(false);
  });

  it("true when any scheme the ref names can lose threat: a side scheme with threat beside the barred main scheme", () => {
    const at = table(6);
    const side = scheme(scheme(at.state, CRISIS, 0).state, SIDE, 3);
    const leap = inPlay(side.state, LEAP_CARD);
    expect(can(leap.state, leap.id, EACH_SCHEME)).toBe(true);
  });

  it("a 'threat cannot be removed' rule is never stepped over, and a ref naming nothing is false", () => {
    const at = table(6);
    const lock = inPlay(at.state, LOCK);
    const leap = inPlay(lock.state, LEAP_CARD);
    expect(can(leap.state, leap.id, MAIN, true)).toBe(false);
    const none = inPlay(table(0).state, LEAP_CARD);
    expect(can(none.state, none.id, EACH_SCHEME)).toBe(false);
  });

  it("Back to the Future: read for the player using the ability", () => {
    const at = table(6, 2);
    const bttf = scheme(at.state, BTTF, 3);
    const leap = inPlay(bttf.state, LEAP_CARD);
    expect(can(leap.state, leap.id, MAIN)).toBe(false);
    expect(can(leap.state, leap.id, EACH_SCHEME)).toBe(true);
  });
});
