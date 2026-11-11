/**
 * A keyword or trait lost by one card for a duration (`EffectSpec grantKeywordUntil.loses`, `grantTraitUntil.loses`):
 * custom content's "ignore one keyword, trait, or status card of your choice until the end of the round" (Marvel
 * Champions Handbook, Gwenpool by PatataSaurio), read as the card losing it.
 *
 * Sources: RRG 1.8 "'Loses'" (p. 27): the card "functions as if it does not possess" the characteristic, which "cannot
 * be regained while the ability causing it to be lost is in effect"; "Lost characteristics are still considered to be
 * printed on the card". "Lasting Effects" (p. 26).
 */

import { trait, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import { hasKeyword, printedKeywordsOf } from "./keywords.js";
import { cardOf } from "./query.js";
import { traitsOf } from "./select.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMinion } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, minionEngagedWith, P1 } from "./testing/wave3.js";

const ELITE = trait("Elite");
const def = (definition: AbilityDefinition) => definition;
const eventOf = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, def({ trigger: { kind: "action" }, effects }));
  return { ability, card: stubEvent({ id, cost: 0, abilities: [ability.ref] }) };
};

const BRUTE = stubMinion({ id: "brute", atk: 1, sch: 1, hp: 9, traits: [ELITE], keywords: [{ name: "guard" }] });
const OTHER = stubMinion({ id: "other", atk: 1, sch: 1, hp: 9, traits: [ELITE], keywords: [{ name: "guard" }] });
const brute = { kind: "each", query: { categories: ["minion"], printedId: BRUTE.id } } as const;

const LOSE_GUARD = eventOf("lose-guard", [
  { kind: "grantKeywordUntil", keyword: { name: "guard" }, target: brute, until: "endOfRound", loses: true },
]);
const GAIN_GUARD = eventOf("gain-guard", [
  { kind: "grantKeywordUntil", keyword: { name: "guard" }, target: brute, until: "endOfRound" },
]);
const LOSE_ELITE = eventOf("lose-elite", [
  { kind: "grantTraitUntil", trait: ELITE, target: brute, until: "endOfRound", loses: true },
]);
const GAIN_ELITE = eventOf("gain-elite", [
  { kind: "grantTraitUntil", trait: ELITE, target: brute, until: "endOfRound" },
]);
const EVENTS = [LOSE_GUARD, GAIN_GUARD, LOSE_ELITE, GAIN_ELITE];

const deps = depsOf(...EVENTS.map((e) => e.ability));

function start() {
  const state = gameAtFirstTurn({
    cards: [BRUTE, OTHER, ...EVENTS.map((e) => e.card)],
    deps,
    deck: EVENTS.flatMap((e) => [e.card.id, e.card.id]),
    encounter: [BRUTE.id, OTHER.id],
  });
  const b = minionEngagedWith(state, BRUTE.id);
  const o = minionEngagedWith(b.state, OTHER.id);
  return { state: o.state, brute: b.id, other: o.id };
}

function run(state: GameState, commands: readonly Command[]) {
  const driven = driveSession(startSession(state), deps, commands);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return driven.session.state;
}
function play(state: GameState, card: CardId) {
  const given = giveCard(state, P1, card);
  return run(given.state, [
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
  ]);
}
const endRound = (state: GameState) => run(state, [{ type: "endTurn", playerId: P1 }]);

describe("losing a keyword or a trait until the end of the round", () => {
  it("the one card loses the keyword, still printed; another card with it keeps it; it comes back as the round ends", () => {
    const { state, brute: b, other } = start();
    const lost = play(state, LOSE_GUARD.card.id);
    expect(hasKeyword(lost, b, "guard", deps)).toBe(false);
    expect(printedKeywordsOf(lost, b, deps)).toEqual([{ name: "guard" }]);
    expect(hasKeyword(lost, other, "guard", deps)).toBe(true);
    // RRG 1.8 "'Loses'": not regained while the loss lasts, even by a new grant.
    expect(hasKeyword(play(lost, GAIN_GUARD.card.id), b, "guard", deps)).toBe(false);
    expect(hasKeyword(endRound(lost), b, "guard", deps)).toBe(true);
  });

  it("the one card loses the trait, still printed; a grant does not give it back; it comes back as the round ends", () => {
    const { state, brute: b, other } = start();
    const lost = play(state, LOSE_ELITE.card.id);
    expect(traitsOf(lost, b, deps)).toEqual([]);
    expect(cardOf(lost, b)).toMatchObject({ traits: [ELITE] });
    expect(traitsOf(lost, other, deps)).toEqual([ELITE]);
    expect(traitsOf(play(lost, GAIN_ELITE.card.id), b, deps)).toEqual([]);
    expect(traitsOf(endRound(lost), b, deps)).toEqual([ELITE]);
  });
});
