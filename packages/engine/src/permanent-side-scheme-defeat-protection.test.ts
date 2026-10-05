/**
 * docs/phase7-wave7.md §3.34 items 1, 3 and 4 (queue task 21): what a double-sided permanent side scheme needs besides
 * its flip-and-reveal (`flip-reveal.test.ts`). Synthetic cards: a permanent side scheme that answers "after the last
 * threat is removed from this scheme", a side scheme whose constant says "the villain cannot be defeated", and
 * listeners on a villain stage's defeat.
 *
 * Sources and readings:
 * - RRG 1.8 "Permanent" (p. 32): "A card with the permanent keyword cannot be defeated, leave play, … except by card
 *   abilities in the same set." RRG 1.8 "Defeat" (p. 15): "if a side scheme has no threat on it, it is defeated", and
 *   "Side Scheme" (p. 40): it "remains in play until there is no threat on it (which causes it to be defeated and
 *   discarded)". Reaching no threat is the game's rule, not a card ability of its set, so by the text a permanent side
 *   scheme with no threat is not defeated (owner ruling 2026-10-05, docs/phase7-wave7.md §4.1): no `schemeDefeated`,
 *   no When Defeated, nothing for "after you defeat a side scheme", and it stays in play with no threat. "After the
 *   last threat is removed from this scheme" is a result of the removal (`lastThreatRemoved`) and still answers.
 * - RRG 1.8 "Defeat" (p. 15): "If a character has zero or fewer remaining hit points … it is defeated"; "'Cannot'"
 *   (p. 11) is absolute while the rule lasts. Owner decision §4.1 Q21 = A: when the rule ends with the villain at zero
 *   or fewer hit points, that stage is defeated at once, with no defeating player; RRG 1.8 "Villain Defeat" (p. 47)
 *   then reveals the next stage or wins the game.
 */

import type { AnyCard, CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, characterProfile, mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubSideScheme, stubSupport, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCard, TREACHERY } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const one = { kind: "const", value: 1 } as const;
const self: TargetRef = { kind: "self" };
const theVillain: TargetRef = { kind: "villain" };
const counter = (id: string, counterType: string, trigger: AbilityDefinition["trigger"], target: TargetRef = self) =>
  stubAbility(id, { trigger, effects: [{ kind: "addCounters", target, counterType, amount: one }] });

/** "Forced Response: After the last threat is removed from this scheme, …" */
const lastThreat = (id: string) =>
  counter(id, "emptied", {
    kind: "response",
    forced: true,
    on: { on: "removeThreat", selfIs: "target", requireResults: { lastThreatRemoved: 1 } },
  });
const GRASP_EMPTIED = lastThreat("grasp.last-threat");
const GRASP_DEFEATED = counter("grasp.when-defeated", "graspDefeated", { kind: "whenDefeated" }, theVillain);
const GRASP = stubSideScheme({
  id: "grasp",
  startingThreat: 4,
  keywords: [{ name: "permanent" }],
  abilities: [GRASP_EMPTIED.ref, GRASP_DEFEATED.ref],
});
/** The same permanent scheme saying of itself that no threat does not defeat it (`notDefeatedWithoutThreat`). */
const SEALED_EMPTIED = lastThreat("sealed.last-threat");
const SEALED_RULE = stubAbility("sealed.constant", {
  trigger: { kind: "constant", rules: [{ kind: "notDefeatedWithoutThreat", target: { self: true } }] },
  effects: [],
});
const SEALED = stubSideScheme({
  id: "sealed",
  startingThreat: 4,
  keywords: [{ name: "permanent" }],
  abilities: [SEALED_EMPTIED.ref, SEALED_RULE.ref, GRASP_DEFEATED.ref],
});
/** The same scheme without the keyword: defeated and discarded at no threat. */
const PLAIN = stubSideScheme({ id: "plain", startingThreat: 4 });

/** "The villain cannot be defeated." on a Victory 1 side scheme, and on both faces of a double-sided one. */
const cannotBeDefeated = (id: string) =>
  stubAbility(id, {
    trigger: { kind: "constant", rules: [{ kind: "cannotBeDefeated", target: { categories: ["villain"] } }] },
    effects: [],
  });
const BOMB_RULE = cannotBeDefeated("bomb.constant");
const BOMB = stubSideScheme({
  id: "bomb",
  startingThreat: 3,
  keywords: [{ name: "victory", value: 1 }],
  abilities: [BOMB_RULE.ref],
});
const FRONT_RULE = cannotBeDefeated("ward.a.constant");
const BACK_RULE = cannotBeDefeated("ward.b.constant");
const WARD_A: AnyCard = {
  ...stubSideScheme({ id: "ward-a", startingThreat: 3, abilities: [FRONT_RULE.ref] }),
  otherFaceId: "ward-b" as CardId,
};
const WARD_B: AnyCard = {
  ...stubSideScheme({ id: "ward-b", startingThreat: 3, abilities: [BACK_RULE.ref] }),
  otherFaceId: "ward-a" as CardId,
};

/** A three-stage villain: stage I's When Defeated and stage II's When Revealed each leave a counter on him. */
const STAGE_ONE_DEFEATED = counter("foe.1.when-defeated", "stageOneDefeated", { kind: "whenDefeated" });
const STAGE_TWO_REVEALED = counter("foe.2.when-revealed", "stageTwoRevealed", { kind: "whenRevealed" });
const FOE = stubVillain({
  id: "foe",
  stages: [
    { hp: { base: 5, perPlayer: 0 }, atk: 1, sch: 1, abilities: [STAGE_ONE_DEFEATED.ref] },
    { hp: { base: 7, perPlayer: 0 }, atk: 1, sch: 1, abilities: [STAGE_TWO_REVEALED.ref] },
    { hp: { base: 9, perPlayer: 0 }, atk: 1, sch: 1 },
  ],
});
const LAST_STAGE_DEFEATED = counter("last.when-defeated", "lastDefeated", { kind: "whenDefeated" });
const LAST = stubVillain({
  id: "last",
  stages: [{ hp: { base: 5, perPlayer: 0 }, atk: 1, sch: 1, abilities: [LAST_STAGE_DEFEATED.ref] }],
});

/** A player's support hearing the defeats. */
const I_DEFEATED = counter("hunter.i-defeated", "iDefeated", {
  kind: "response",
  forced: false,
  on: { on: "characterDefeated", playerIs: "controller", targetIs: { categories: ["villain"] } },
});
const SAW_DEFEAT = counter("hunter.saw-defeat", "sawDefeat", {
  kind: "response",
  forced: true,
  on: { on: "characterDefeated", targetIs: { categories: ["villain"] } },
});
const stageDefeated = (stage: number) =>
  counter(`hunter.saw-stage-${stage}`, `sawStage${stage}`, {
    kind: "response",
    forced: true,
    on: {
      on: "characterDefeated",
      targetIs: { categories: ["villain"] },
      eventAtLeast: { villainStageNumber: stage },
      eventAtMost: { villainStageNumber: stage },
    },
  });
const SAW_STAGE_ONE = stageDefeated(1);
const SAW_STAGE_TWO = stageDefeated(2);
const I_DEFEATED_SCHEME = counter("hunter.i-defeated-scheme", "iDefeatedScheme", {
  kind: "response",
  forced: false,
  on: { on: "schemeDefeated", playerIs: "controller" },
});
const SAW_SCHEME_DEFEATED = counter("hunter.saw-scheme-defeated", "sawSchemeDefeated", {
  kind: "interrupt",
  forced: true,
  on: { on: "schemeDefeated" },
});
const SAW_LAST_THREAT = counter("hunter.saw-last-threat", "sawLastThreat", {
  kind: "response",
  forced: true,
  on: { on: "removeThreat", requireResults: { lastThreatRemoved: 1 } },
});
const HUNTER = stubSupport({
  id: "hunter",
  cost: 0,
  abilities: [
    I_DEFEATED.ref,
    SAW_DEFEAT.ref,
    SAW_STAGE_ONE.ref,
    SAW_STAGE_TWO.ref,
    I_DEFEATED_SCHEME.ref,
    SAW_SCHEME_DEFEATED.ref,
    SAW_LAST_THREAT.ref,
  ],
});

const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const amount = (value: number) => ({ kind: "const", value }) as const;
const sideSchemes: TargetRef = { kind: "each", query: { categories: ["sideScheme"] } };
const HIT_5 = action("hit-5", [{ kind: "dealDamage", target: theVillain, amount: amount(5) }]);
const HIT_7 = action("hit-7", [{ kind: "dealDamage", target: theVillain, amount: amount(7) }]);
const MEND_3 = action("mend-3", [{ kind: "heal", target: theVillain, amount: amount(3) }]);
const CHIP = action("chip", [{ kind: "removeThreat", target: sideSchemes, amount: amount(1) }]);
const EMPTY = action("empty", [{ kind: "removeThreat", target: sideSchemes, amount: amount(20) }]);
const FLIP = action("flip", [{ kind: "flipCard", target: sideSchemes }]);
const ACTIONS = [HIT_5, HIT_7, MEND_3, CHIP, EMPTY, FLIP];

const deps: EngineDeps = depsOf(
  GRASP_EMPTIED,
  GRASP_DEFEATED,
  SEALED_EMPTIED,
  SEALED_RULE,
  BOMB_RULE,
  FRONT_RULE,
  BACK_RULE,
  STAGE_ONE_DEFEATED,
  STAGE_TWO_REVEALED,
  LAST_STAGE_DEFEATED,
  I_DEFEATED,
  SAW_DEFEAT,
  SAW_STAGE_ONE,
  SAW_STAGE_TWO,
  I_DEFEATED_SCHEME,
  SAW_SCHEME_DEFEATED,
  SAW_LAST_THREAT,
  ...ACTIONS.map((a) => a.ability),
);
const SCHEMES = [GRASP, SEALED, PLAIN, BOMB, WARD_A, WARD_B];

function start(villain: ReturnType<typeof stubVillain> = FOE): GameState {
  return gameAtFirstTurn({
    cards: [...SCHEMES, FOE, LAST, HUNTER, ...ACTIONS.map((a) => a.card)],
    deps,
    villain,
    encounter: [GRASP.id, SEALED.id, PLAIN.id, BOMB.id, WARD_A.id, ...copiesOf(TREACHERY.id, 20)],
    deck: [HUNTER.id, ...ACTIONS.map((a) => a.card.id)],
  });
}
/** `scheme` in the villain's area with its starting threat (surgery). */
const withScheme = (state: GameState, scheme: AnyCard, threat: number) =>
  encounterCardInVillainArea(state, scheme.id, threat);

/** Accepts every optional trigger offered; otherwise the default pick. */
const accept = (state: GameState): readonly string[] => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
  return defaultPick(state);
};
function play(state: GameState, card: CardId) {
  const given = giveCard(state, P1, card);
  return runCommandsPicking(given.state, deps, accept, {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}
/** Plays the cards one after another, returning the last result and every event. */
function playAll(state: GameState, ...cards: readonly CardId[]) {
  let current = state;
  const events: GameEvent[] = [];
  let last: ReturnType<typeof play> | undefined;
  for (const card of cards) {
    last = play(current, card);
    current = last.state;
    events.push(...last.events);
  }
  return { state: current, events, session: last!.session };
}

const counters = (state: GameState, id: InstanceId) => mustInstance(state, id).counters;
const foe = (state: GameState) => activeVillain(state);
const foeCounters = (state: GameState) => counters(state, foe(state).instanceId);
const foeDamage = (state: GameState) => mustInstance(state, foe(state).instanceId).damage;
const offers = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "choiceRequested" && e.choice.prompt.kind === "chooseTriggers").length;
const logged = (events: readonly GameEvent[], type: GameEvent["type"]) => events.filter((e) => e.type === type).length;
/** The resolved defeats of the villain, as the trigger log shows them. */
const villainDefeats = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "characterDefeated" ? [e.event] : [],
  );

describe("§3.34 a permanent side scheme whose last threat is removed", () => {
  it("answers its own 'after the last threat is removed from here' once and stays in play", () => {
    const scheme = withScheme(start(), GRASP, 4);
    const { state } = play(scheme.state, EMPTY.card.id);
    expect(mustInstance(state, scheme.id).threat).toBe(0);
    expect(counters(state, scheme.id)).toEqual({ emptied: 1 });
    expect(state.villainArea).toContain(scheme.id);
    expect(state.victoryDisplay).not.toContain(scheme.id);
    expect(Object.values(state.encounterDecks).flatMap((piles) => piles.discard)).not.toContain(scheme.id);
    expect(state.removedFromGame).not.toContain(scheme.id);
  });

  // RRG 1.8 "Permanent" (p. 32): it "cannot be defeated", and reaching no threat is not a card ability of its set.
  it("is not defeated: no schemeDefeated, no When Defeated, nothing for 'after you defeat a side scheme'", () => {
    const scheme = withScheme(start(), GRASP, 4);
    const hunter = playerCardIntoPlay(scheme.state, HUNTER.id);
    const { state, events } = play(hunter.state, EMPTY.card.id);
    expect(mustInstance(state, scheme.id).threat).toBe(0);
    expect(state.villainArea).toContain(scheme.id);
    expect(state.victoryDisplay).not.toContain(scheme.id);
    expect(logged(events, "schemeDefeated")).toBe(0);
    expect(logged(events, "leavePlayBlocked")).toBe(0);
    // Its When Defeated would have marked the villain; the optional "after you defeat a side scheme" is never offered.
    expect(foeCounters(state)).toEqual({});
    expect(offers(events)).toBe(0);
    expect(counters(state, scheme.id)).toEqual({ emptied: 1 });
    expect(counters(state, hunter.id)).toEqual({ sawLastThreat: 1 });
  });

  it("a basic thwart that removes its last threat does not defeat it either, and the thwart still happened", () => {
    const scheme = withScheme(start(), GRASP, 1);
    const hunter = playerCardIntoPlay(scheme.state, HUNTER.id);
    const hero = hunter.state.players[0]!.identity.instanceId;
    const { state, events } = runCommandsPicking(
      hunter.state,
      deps,
      accept,
      { type: "changeForm", playerId: P1 },
      { type: "basicThwart", playerId: P1, thwarterInstanceId: hero, schemeInstanceId: scheme.id },
    );
    expect(mustInstance(state, scheme.id).threat).toBe(0);
    expect(mustInstance(state, hero).exhausted).toBe(true);
    expect(state.villainArea).toContain(scheme.id);
    expect(logged(events, "threatRemoved")).toBe(1);
    expect(logged(events, "schemeDefeated")).toBe(0);
    expect(logged(events, "leavePlayBlocked")).toBe(0);
    expect(foeCounters(state)).toEqual({});
    expect(counters(state, scheme.id)).toEqual({ emptied: 1 });
    expect(counters(state, hunter.id)).toEqual({ sawLastThreat: 1 });
  });

  it("emptied twice, it is not defeated either time, and replays to the same state", () => {
    const scheme = withScheme(start(), GRASP, 1);
    const emptied = play(scheme.state, CHIP.card.id);
    const refilled: GameState = {
      ...emptied.state,
      instances: { ...emptied.state.instances, [scheme.id]: { ...mustInstance(emptied.state, scheme.id), threat: 2 } },
    };
    const again = play(refilled, EMPTY.card.id);
    expect(logged([...emptied.events, ...again.events], "schemeDefeated")).toBe(0);
    expect(counters(again.state, scheme.id)).toEqual({ emptied: 2 });
    expect(foeCounters(again.state)).toEqual({});
    const replayed = replay(emptied.session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(emptied.session.state);
  });

  it("with 'no threat does not defeat this' it is not defeated: no When Defeated, nothing for 'after you defeat'", () => {
    const scheme = withScheme(start(), SEALED, 4);
    const hunter = playerCardIntoPlay(scheme.state, HUNTER.id);
    const { state, events } = play(hunter.state, EMPTY.card.id);
    expect(counters(state, scheme.id)).toEqual({ emptied: 1 });
    expect(state.villainArea).toContain(scheme.id);
    expect(foeCounters(state)).toEqual({});
    expect(logged(events, "schemeDefeated")).toBe(0);
    expect(logged(events, "leavePlayBlocked")).toBe(0);
    expect(offers(events)).toBe(0);
    expect(counters(state, hunter.id)).toEqual({ sawLastThreat: 1 });
  });

  it("does not answer a removal that leaves threat, nor one from a scheme already empty", () => {
    const scheme = withScheme(start(), GRASP, 4);
    const chipped = play(scheme.state, CHIP.card.id).state;
    expect(mustInstance(chipped, scheme.id).threat).toBe(3);
    expect(counters(chipped, scheme.id)).toEqual({});
    const emptied = playAll(chipped, EMPTY.card.id, EMPTY.card.id, CHIP.card.id).state;
    expect(counters(emptied, scheme.id)).toEqual({ emptied: 1 });
  });

  it("answers again after threat is placed on it and removed", () => {
    const scheme = withScheme(start(), GRASP, 1);
    const emptied = play(scheme.state, CHIP.card.id).state;
    const refilled: GameState = {
      ...emptied,
      instances: { ...emptied.instances, [scheme.id]: { ...mustInstance(emptied, scheme.id), threat: 2 } },
    };
    expect(counters(play(refilled, EMPTY.card.id).state, scheme.id)).toEqual({ emptied: 2 });
  });

  it("control: the same scheme without the keyword is defeated, discarded and answers 'after you defeat'", () => {
    const scheme = withScheme(start(), PLAIN, 4);
    const hunter = playerCardIntoPlay(scheme.state, HUNTER.id);
    const { state, events } = play(hunter.state, EMPTY.card.id);
    expect(state.villainArea).not.toContain(scheme.id);
    expect(Object.values(state.encounterDecks).flatMap((piles) => piles.discard)).toContain(scheme.id);
    expect(logged(events, "schemeDefeated")).toBe(1);
    expect(offers(events)).toBe(1);
    expect(counters(state, hunter.id)).toEqual({ sawLastThreat: 1, sawSchemeDefeated: 1, iDefeatedScheme: 1 });
  });
});

describe("§3.34 a villain stage's defeat names its stage number", () => {
  it("a listener filtered on stage I hears only stage I's defeat; the event carries the stage that fell", () => {
    const hunter = playerCardIntoPlay(start(), HUNTER.id);
    const { state, events } = play(hunter.state, HIT_5.card.id);
    expect(foe(state).stageIndex).toBe(1);
    expect(counters(state, hunter.id)).toEqual({ iDefeated: 1, sawDefeat: 1, sawStage1: 1 });
    expect(villainDefeats(events).map((e) => e.villainStageNumber)).toEqual([1]);
  });

  it("a listener filtered on stage II hears only stage II's defeat", () => {
    const hunter = playerCardIntoPlay(start(), HUNTER.id);
    const { state, events } = playAll(hunter.state, HIT_5.card.id, HIT_7.card.id);
    expect(foe(state).stageIndex).toBe(2);
    expect(counters(state, hunter.id)).toEqual({ iDefeated: 2, sawDefeat: 2, sawStage1: 1, sawStage2: 1 });
    expect(villainDefeats(events).map((e) => e.villainStageNumber)).toEqual([1, 2]);
  });
});

describe("§3.34 'the villain cannot be defeated' on a card in play (§4.1 Q21)", () => {
  it("at zero and below zero hit points he is not defeated, keeps taking damage, and no When Defeated resolves", () => {
    const bomb = withScheme(start(), BOMB, 3);
    const atZero = play(bomb.state, HIT_5.card.id);
    expect(foeDamage(atZero.state)).toBe(5);
    expect(foe(atZero.state).stageIndex).toBe(0);
    expect(atZero.state.heldAtZero).toEqual([foe(atZero.state).instanceId]);
    const below = play(atZero.state, HIT_7.card.id);
    expect(foeDamage(below.state)).toBe(12);
    expect(foe(below.state).stageIndex).toBe(0);
    expect(foeCounters(below.state)).toEqual({});
    expect(below.state.outcome).toBeNull();
    expect(logged([...atZero.events, ...below.events], "characterDefeated")).toBe(0);
    expect(logged([...atZero.events, ...below.events], "defeatProtectionEnded")).toBe(0);
  });

  it("when the granting card leaves play he is defeated at once: next stage, its hit points and When Revealed", () => {
    const bomb = withScheme(start(), BOMB, 3);
    const held = playAll(bomb.state, HIT_5.card.id, HIT_7.card.id).state;
    const { state, events } = play(held, EMPTY.card.id);
    expect(state.victoryDisplay).toContain(bomb.id);
    const villain = foe(state);
    expect(villain.stageIndex).toBe(1);
    expect(foeDamage(state)).toBe(0);
    expect(characterProfile(state, villain.instanceId, deps)?.maxHp).toBe(7);
    expect(foeCounters(state)).toEqual({ stageOneDefeated: 1, stageTwoRevealed: 1 });
    expect(state.heldAtZero).toEqual([]);
    expect(state.outcome).toBeNull();
    // The scheme leaves, the protection is logged as ended, then the stage advances.
    const order = events.map((e) => e.type);
    expect(order.indexOf("defeatProtectionEnded")).toBeGreaterThan(order.indexOf("schemeDefeated"));
    expect(order.indexOf("villainStageAdvanced")).toBeGreaterThan(order.indexOf("defeatProtectionEnded"));
    expect(logged(events, "defeatProtectionEnded")).toBe(1);
  });

  it("that defeat has no defeating player: 'after you defeat the villain' is not offered, the log names nobody", () => {
    const bomb = withScheme(start(), BOMB, 3);
    const hunter = playerCardIntoPlay(bomb.state, HUNTER.id);
    const held = play(hunter.state, HIT_5.card.id).state;
    expect(counters(held, hunter.id)).toEqual({});
    const { state, events } = play(held, EMPTY.card.id);
    expect(foe(state).stageIndex).toBe(1);
    // The scheme's own defeat is the player's; the villain's is nobody's.
    expect(counters(state, hunter.id)).toEqual({
      sawLastThreat: 1,
      sawSchemeDefeated: 1,
      iDefeatedScheme: 1,
      sawDefeat: 1,
      sawStage1: 1,
    });
    const [defeat, ...rest] = villainDefeats(events);
    expect(rest).toEqual([]);
    expect(defeat?.defeatedByPlayerId).toBeUndefined();
    expect(defeat?.sourceInstanceId).toBeUndefined();
    expect(defeat?.villainStageNumber).toBe(1);
  });

  it("on the final stage that defeat wins the game", () => {
    const bomb = withScheme(start(LAST), BOMB, 3);
    const held = play(bomb.state, HIT_5.card.id).state;
    expect(held.outcome).toBeNull();
    const { state } = play(held, EMPTY.card.id);
    expect(state.outcome).toEqual({ result: "win", reason: "villainDefeated" });
    expect(foe(state).defeated).toBe(true);
  });

  it("healed above zero before the rule ends, nothing happens when it ends", () => {
    const bomb = withScheme(start(), BOMB, 3);
    const healed = playAll(bomb.state, HIT_5.card.id, MEND_3.card.id).state;
    expect(foeDamage(healed)).toBe(2);
    expect(healed.heldAtZero).toEqual([]);
    const { state, events } = play(healed, EMPTY.card.id);
    expect(state.victoryDisplay).toContain(bomb.id);
    expect(foe(state).stageIndex).toBe(0);
    expect(foeDamage(state)).toBe(2);
    expect(foeCounters(state)).toEqual({});
    expect(logged(events, "defeatProtectionEnded")).toBe(0);
  });

  it("the granting card flipping to a face that grants it too does not defeat him; that face leaving does", () => {
    const ward = withScheme(start(), WARD_A, 3);
    const flipped = playAll(ward.state, HIT_5.card.id, FLIP.card.id);
    expect(mustInstance(flipped.state, ward.id).cardId).toBe(WARD_B.id);
    expect(foe(flipped.state).stageIndex).toBe(0);
    expect(foeDamage(flipped.state)).toBe(5);
    expect(logged(flipped.events, "defeatProtectionEnded")).toBe(0);
    const { state } = play(flipped.state, EMPTY.card.id);
    expect(foe(state).stageIndex).toBe(1);
    expect(foeCounters(state)).toEqual({ stageOneDefeated: 1, stageTwoRevealed: 1 });
  });

  it("control: without the rule the same damage defeats the stage for the player who dealt it", () => {
    const hunter = playerCardIntoPlay(start(), HUNTER.id);
    const { events } = play(hunter.state, HIT_5.card.id);
    expect(villainDefeats(events).map((e) => e.defeatedByPlayerId)).toEqual([P1]);
    expect(logged(events, "defeatProtectionEnded")).toBe(0);
  });

  it("replays to the same state", () => {
    const bomb = withScheme(start(), BOMB, 3);
    const held = play(bomb.state, HIT_5.card.id).state;
    const { session } = play(held, EMPTY.card.id);
    const replayed = replay(session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(session.state);
  });
});
