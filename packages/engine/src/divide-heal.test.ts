/**
 * `EffectSpec divide` of healing (`what: "heal"`). Synthetic cards shaped like Compassion (`mut_gen` 32182): "heal 3
 * damage from among characters you control."
 *
 * Sources: RRG 1.8 "Heal" (p. 22: "A heal effect can only bring a character to its maximum hit points"), so a character
 * takes no more healing than the damage on it; "Target" (p. 43: a target is valid "if any part of that ability can
 * affect that target"), so an undamaged character, or one that cannot be healed by this card, is no candidate.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubAlly, stubEvent, stubMinion, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard, TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const n = (value: number): ValueSpec => ({ kind: "const", value });
const you = { kind: "controller" } as const;
const yours = { categories: ["character"], controller: "you" } as const;
const pot = { kind: "each", query: { categories: ["support"], name: "pot" } } as const;

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Heal 3 damage from among characters you control", the damage healed tallied on the pot. */
const MEND = actionEvent("mend", [
  { kind: "divide", what: "heal", amount: n(3), among: yours, chooser: you, bind: "healed" },
  { kind: "addCounters", target: pot, counterType: "healed", amount: { kind: "var", name: "healed.amount" } },
]);
/** "Heal a total of up to 3 damage from among characters you control." */
const MEND_UP_TO = actionEvent("mend-up-to", [
  { kind: "divide", what: "heal", amount: n(3), among: yours, chooser: you, upTo: true },
]);
/** "The medic cannot be healed by player card effects." */
const WARD_RULE = stubAbility("ward.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "cannotBeHealed", target: { name: "medic" }, bySource: "playerCard" }],
  },
  effects: [],
});
const WARD = stubSupport({ id: "ward", cost: 0, abilities: [WARD_RULE.ref] });
const POT = stubSupport({ id: "pot", cost: 0 });
const MEDIC = stubAlly({ id: "medic", cost: 0, atk: 1, thw: 1, hp: 5 });
const SCOUT = stubAlly({ id: "scout", cost: 0, atk: 1, thw: 1, hp: 5 });
const GOON = stubMinion({ id: "goon", atk: 1, sch: 1, hp: 10 });
const EVENTS = [MEND, MEND_UP_TO];
const deps: EngineDeps = depsOf(WARD_RULE, ...EVENTS.map((e) => e.ability));

const hurt = (state: GameState, id: InstanceId, damage: number): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), damage } },
});
const damageOf = (state: GameState, id: InstanceId) => mustInstance(state, id).damage;

/** Two players. P1's identity and two allies, another player's ally and a minion, each with `damage` on it. */
function table(damage: { identity: number; medic: number; scout: number }) {
  let state = gameAtFirstTurn({
    cards: [POT, WARD, MEDIC, SCOUT, GOON, ...EVENTS.map((e) => e.card)],
    deps,
    players: 2,
    encounter: [GOON.id, ...copiesOf(TREACHERY.id, 20)],
    deck: [POT.id, WARD.id, MEDIC.id, SCOUT.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
  });
  const put = (card: CardId, player = P1) => {
    const placed = playerCardIntoPlay(state, card, player);
    state = placed.state;
    return placed.id;
  };
  const medic = put(MEDIC.id);
  const scout = put(SCOUT.id);
  const potId = put(POT.id);
  const theirs = put(MEDIC.id, P2);
  const goon = minionEngagedWith(state, GOON.id);
  const identity = mustPlayer(goon.state, P1).identity.instanceId;
  state = hurt(hurt(hurt(goon.state, identity, damage.identity), medic, damage.medic), scout, damage.scout);
  state = hurt(hurt(state, theirs, 4), goon.id, 4);
  return { state, identity, medic, scout, pot: potId, theirs, goon: goon.id };
}

/** Plays `event` for 0, answering a divide choice with `shares` (or, given a function, with what it returns). */
function play(
  state: GameState,
  event: { card: { id: CardId } },
  shares: readonly string[] | ((offered: readonly string[]) => readonly string[]),
) {
  const given = giveCard(state, P1, event.card.id);
  const asked: { min?: number; max?: number; amount?: number; what?: string; options?: readonly string[] } = {};
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (choice?.prompt.kind !== "divide") return defaultPick(current);
    asked.min = choice.minSelections;
    asked.max = choice.maxSelections;
    asked.amount = choice.prompt.amount;
    asked.what = choice.prompt.what;
    asked.options = choice.options.map((o) => o.optionId);
    return typeof shares === "function" ? shares(asked.options) : shares;
  };
  const run = runCommandsPicking(given.state, deps, pick, {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
  return { ...run, asked };
}

describe("divide heal", () => {
  it("the chooser splits the heal among their damaged characters, each offered no more points than its damage", () => {
    const t = table({ identity: 4, medic: 1, scout: 2 });
    const { state, asked, session } = play(t.state, MEND, [`${t.identity}#1`, `${t.identity}#2`, `${t.medic}#1`]);
    expect(asked).toMatchObject({ what: "heal", amount: 3, min: 3, max: 3 });
    expect(new Set(asked.options)).toEqual(
      new Set([
        `${t.identity}#1`,
        `${t.identity}#2`,
        `${t.identity}#3`,
        `${t.medic}#1`,
        `${t.scout}#1`,
        `${t.scout}#2`,
      ]),
    );
    expect([damageOf(state, t.identity), damageOf(state, t.medic), damageOf(state, t.scout)]).toEqual([2, 0, 2]);
    // Another player's ally and an enemy are not "characters you control".
    expect([damageOf(state, t.theirs), damageOf(state, t.goon)]).toEqual([4, 4]);
    expect(mustInstance(state, t.pot).counters.healed).toBe(3);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("the whole amount is healed: fewer points than the damage held allows are refused", () => {
    const t = table({ identity: 4, medic: 1, scout: 2 });
    expect(() => play(t.state, MEND, [`${t.identity}#1`, `${t.medic}#1`])).toThrow(/rejected/);
  });

  it("an undamaged character is no candidate; a single damaged one takes the heal without a choice", () => {
    const t = table({ identity: 0, medic: 0, scout: 4 });
    const { state, asked } = play(t.state, MEND, []);
    expect(asked).toEqual({});
    expect(damageOf(state, t.scout)).toBe(1);
    expect(mustInstance(state, t.pot).counters.healed).toBe(3);
  });

  it("no more damage than the amount among several characters: each is healed in full, without a choice", () => {
    const t = table({ identity: 1, medic: 0, scout: 1 });
    const { state, asked } = play(t.state, MEND, []);
    expect(asked).toEqual({});
    expect([damageOf(state, t.identity), damageOf(state, t.scout)]).toEqual([0, 0]);
    expect(mustInstance(state, t.pot).counters.healed).toBe(2);
  });

  it("nobody damaged: nothing is asked and nothing is healed", () => {
    const t = table({ identity: 0, medic: 0, scout: 0 });
    const { state, asked, events } = play(t.state, MEND, []);
    expect(asked).toEqual({});
    expect(events.some((e) => e.type === "damageHealed")).toBe(false);
    expect(mustInstance(state, t.pot).counters.healed ?? 0).toBe(0);
  });

  it("a character that cannot be healed by this card is no candidate (`cannotBeHealed`)", () => {
    const t = table({ identity: 2, medic: 3, scout: 2 });
    const warded = playerCardIntoPlay(t.state, WARD.id).state;
    const { state, asked } = play(warded, MEND, [`${t.identity}#1`, `${t.scout}#1`, `${t.scout}#2`]);
    expect(asked.options?.some((id) => id.startsWith(`${t.medic}#`))).toBe(false);
    expect([damageOf(state, t.identity), damageOf(state, t.medic), damageOf(state, t.scout)]).toEqual([1, 3, 0]);
  });

  it("'up to': 1 to the amount, asked even with one candidate, and never none while something can be healed", () => {
    const t = table({ identity: 0, medic: 0, scout: 4 });
    const { state, asked } = play(t.state, MEND_UP_TO, [`${t.scout}#1`]);
    expect(asked).toMatchObject({ min: 1, max: 3 });
    expect(damageOf(state, t.scout)).toBe(3);
    expect(() => play(t.state, MEND_UP_TO, [])).toThrow(/rejected/);
  });
});
