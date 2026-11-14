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
import { hasKeyword, isPermanent, printedKeywordsOf } from "./keywords.js";
import { cardOf } from "./query.js";
import { permanentProtectsFrom, traitsOf } from "./select.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { giveCard, TREACHERY } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  playerCardIntoPlay,
} from "./testing/wave3.js";

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
/** A permanent support of P1's, and an event that makes it lose Permanent until the end of the round. */
const KEEPER = stubSupport({ id: "keeper", cost: 0, keywords: [{ name: "permanent" }] });
const keeper = { kind: "each", query: { categories: ["support"], printedId: KEEPER.id } } as const;
const LOSE_PERMANENT = eventOf("lose-permanent", [
  { kind: "grantKeywordUntil", keyword: { name: "permanent" }, target: keeper, until: "endOfRound", loses: true },
]);
const EVENTS = [LOSE_GUARD, GAIN_GUARD, LOSE_ELITE, GAIN_ELITE, LOSE_PERMANENT];

/** Constants on a side scheme: each minion gains guard and Elite; each support loses Permanent. */
const RULES = stubAbility(
  "rules.constant",
  def({
    trigger: {
      kind: "constant",
      keywordGrants: [
        { keyword: { name: "guard" }, target: { categories: ["minion"] } },
        { keyword: { name: "permanent" }, target: { categories: ["support"] }, loses: true },
      ],
      traitGrants: [{ trait: ELITE, target: { categories: ["minion"] } }],
    },
    effects: [],
  }),
);
const RULES_CARD = stubSideScheme({ id: "rules", startingThreat: 5, abilities: [RULES.ref] });

const deps = depsOf(RULES, ...EVENTS.map((e) => e.ability));

function start() {
  const state = gameAtFirstTurn({
    cards: [BRUTE, OTHER, KEEPER, RULES_CARD, ...EVENTS.map((e) => e.card)],
    deps,
    deck: [KEEPER.id, ...EVENTS.flatMap((e) => [e.card.id, e.card.id])],
    encounter: [BRUTE.id, OTHER.id, RULES_CARD.id, ...copiesOf(TREACHERY.id, 10)],
  });
  const b = minionEngagedWith(state, BRUTE.id);
  const o = minionEngagedWith(b.state, OTHER.id);
  const k = playerCardIntoPlay(o.state, KEEPER.id);
  return { state: k.state, brute: b.id, other: o.id, keeper: k.id };
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

  it("a constant grant does not give back a lost keyword or trait while the loss lasts", () => {
    const { state, brute: b } = start();
    const ruled = encounterCardInVillainArea(state, RULES_CARD.id, 5).state;
    const lost = play(play(ruled, LOSE_GUARD.card.id), LOSE_ELITE.card.id);
    expect(hasKeyword(lost, b, "guard", deps)).toBe(false);
    expect(traitsOf(lost, b, deps)).toEqual([]);
  });

  it("a lost Permanent no longer protects or counts, printed or not; it comes back as the round ends", () => {
    const { state, keeper: k } = start();
    const other = BRUTE.id;
    expect(isPermanent(state, k, deps)).toBe(true);
    expect(permanentProtectsFrom(state, k, other, deps)).toBe(true);
    const lost = play(state, LOSE_PERMANENT.card.id);
    expect(isPermanent(lost, k, deps)).toBe(false);
    expect(permanentProtectsFrom(lost, k, other, deps)).toBe(false);
    expect(printedKeywordsOf(lost, k, deps)).toEqual([{ name: "permanent" }]);
    expect(isPermanent(endRound(lost), k, deps)).toBe(true);
  });

  it("a constant loss of Permanent works the same way", () => {
    const { state, keeper: k } = start();
    const ruled = encounterCardInVillainArea(state, RULES_CARD.id, 5).state;
    expect(isPermanent(ruled, k, deps)).toBe(false);
    expect(permanentProtectsFrom(ruled, k, BRUTE.id, deps)).toBe(false);
  });
});
