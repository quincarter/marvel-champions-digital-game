/**
 * docs/phase7-wave6.md §3.13: a card losing a keyword (`KeywordGrantSpec.loses`). Synthetic cards shaped like Physical
 * Strain (`mut_gen` 32145b: "Magneto loses steady.") on steady minions.
 *
 * Sources: RRG 1.8 "'Loses'" (p. 27): the card "functions as if it does not possess" the characteristic, which "cannot
 * be regained while the ability causing it to be lost is in effect, even if a new effect would cause the characteristic
 * to be gained"; "Lost characteristics are still considered to be printed on the card". "Steady" (p. 41), "Status
 * Cards" (p. 42).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, KeywordGrantSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { hasKeyword, keywordsOf, keywordTotal, printedKeywordsOf, statusActive } from "./keywords.js";
import { mustInstance } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSideScheme } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, minionEngagedWith, P1 } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const n = (value: number) => ({ kind: "const", value }) as const;
const grantCard = (id: string, grant: KeywordGrantSpec) => {
  const ability = stubAbility(
    `${id}.constant`,
    def({ trigger: { kind: "constant", keywordGrants: [grant] }, effects: [] }),
  );
  return { ability, card: stubSideScheme({ id, startingThreat: 5, abilities: [ability.ref] }) };
};

/** Physical Strain's shape: "Each minion loses steady." */
const STRAIN = grantCard("strain", { keyword: { name: "steady" }, target: { categories: ["minion"] }, loses: true });
/** "Each minion gains steady." */
const RALLY = grantCard("rally", { keyword: { name: "steady" }, target: { categories: ["minion"] } });
/** "Each minion loses retaliate." A numbered keyword is lost by name. */
const DISARM = grantCard("disarm", {
  keyword: { name: "retaliate", value: 0 },
  target: { categories: ["minion"] },
  loses: true,
});

/** Prints steady, guard and retaliate 1. */
const BRUTE = stubMinion({
  id: "brute",
  atk: 1,
  sch: 1,
  hp: 9,
  boostIcons: 0,
  keywords: [{ name: "steady" }, { name: "guard" }, { name: "retaliate", value: 1 }],
});
/** No keywords of its own. */
const GRUNT = stubMinion({ id: "grunt", atk: 1, sch: 1, hp: 9, boostIcons: 0 });

const eachMinion = { kind: "each", query: { categories: ["minion"] } } as const;
const eventOf = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, def({ trigger: { kind: "action" }, effects }));
  return { ability, card: stubEvent({ id, cost: 0, abilities: [ability.ref] }) };
};
const STUN = eventOf("stun", [{ kind: "giveStatus", target: eachMinion, status: "stunned" }]);
const CLEAR_STRAIN = eventOf("clear-strain", [
  { kind: "removeThreat", target: { kind: "named", name: "strain" }, amount: n(5) },
]);
const NOTHING = eventOf("nothing", [{ kind: "draw", player: { kind: "controller" }, amount: n(0) }]);

const deps = depsOf(STRAIN.ability, RALLY.ability, DISARM.ability, STUN.ability, CLEAR_STRAIN.ability, NOTHING.ability);
const EVENTS = [STUN.card, CLEAR_STRAIN.card, NOTHING.card];

/** Brute and Grunt engaged with P1, and the rule cards `rules` in the villain's area with 5 threat each. */
function start(...rules: readonly CardId[]) {
  let state = gameAtFirstTurn({
    cards: [STRAIN.card, RALLY.card, DISARM.card, BRUTE, GRUNT, ...EVENTS],
    deps,
    deck: EVENTS.map((card) => card.id),
    encounter: [STRAIN.card.id, RALLY.card.id, DISARM.card.id, BRUTE.id, GRUNT.id],
  });
  for (const rule of rules) state = encounterCardInVillainArea(state, rule, 5).state;
  const brute = minionEngagedWith(state, BRUTE.id);
  const grunt = minionEngagedWith(brute.state, GRUNT.id);
  return { state: grunt.state, brute: brute.id, grunt: grunt.id };
}

function run(state: GameState, commands: readonly Command[]) {
  const driven = driveSession(startSession(state), deps, commands);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return { state: driven.session.state, events: driven.events };
}
function play(state: GameState, card: CardId) {
  const given = giveCard(state, P1, card);
  return run(given.state, [
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
  ]);
}
const stunsOf = (state: GameState, id: InstanceId) => mustInstance(state, id).statuses.stunned;

describe("§3.13 a card losing a keyword", () => {
  it("a lost printed keyword is gone; its other keywords stay; it is still printed", () => {
    const { state, brute } = start(STRAIN.card.id);
    expect(keywordsOf(state, brute, deps)).toEqual([{ name: "guard" }, { name: "retaliate", value: 1 }]);
    expect(hasKeyword(state, brute, "steady", deps)).toBe(false);
    expect(hasKeyword(state, brute, "guard", deps)).toBe(true);
    expect(keywordTotal(state, brute, "retaliate", deps)).toBe(1);
    expect(printedKeywordsOf(state, brute, deps)).toEqual(BRUTE.keywords);
  });

  it("without the rule, one stun card does not stun a steady minion; with it, one does", () => {
    const steady = play(start().state, STUN.card.id);
    const plainBrute = start().brute;
    expect(stunsOf(steady.state, plainBrute)).toBe(1);
    expect(statusActive(steady.state, plainBrute, "stunned", deps)).toBe(false);

    const strained = start(STRAIN.card.id);
    const stunned = play(strained.state, STUN.card.id);
    expect(stunsOf(stunned.state, strained.brute)).toBe(1);
    expect(statusActive(stunned.state, strained.brute, "stunned", deps)).toBe(true);
  });

  it("a lost steady drops the capacity at once: a second stun card is removed (state check)", () => {
    const game = start();
    const twice = play(play(game.state, STUN.card.id).state, STUN.card.id).state;
    expect(stunsOf(twice, game.brute)).toBe(2);
    // The strain comes into play by surgery; the next state check trims the excess card.
    const strained = encounterCardInVillainArea(twice, STRAIN.card.id, 5).state;
    const { state, events } = play(strained, NOTHING.card.id);
    expect(stunsOf(state, game.brute)).toBe(1);
    expect(events.filter((e) => e.type === "statusRemoved")).toEqual([
      { type: "statusRemoved", instanceId: game.brute, status: "stunned", reason: "cannotHave" },
    ]);
  });

  it("a granted copy is lost too: losing beats gaining", () => {
    const rallied = start(RALLY.card.id);
    expect(keywordsOf(rallied.state, rallied.grunt, deps)).toEqual([{ name: "steady" }]);
    expect(keywordsOf(rallied.state, rallied.brute, deps)).toEqual([...BRUTE.keywords, { name: "steady" }]);

    const both = start(RALLY.card.id, STRAIN.card.id);
    expect(keywordsOf(both.state, both.grunt, deps)).toEqual([]);
    expect(keywordsOf(both.state, both.brute, deps)).toEqual([{ name: "guard" }, { name: "retaliate", value: 1 }]);
    // The order the two rules entered play in does not matter.
    const reversed = start(STRAIN.card.id, RALLY.card.id);
    expect(hasKeyword(reversed.state, reversed.grunt, "steady", deps)).toBe(false);
    expect(hasKeyword(reversed.state, reversed.brute, "steady", deps)).toBe(false);
  });

  it("a numbered keyword is lost by name, whatever its value", () => {
    const { state, brute } = start(DISARM.card.id);
    expect(keywordsOf(state, brute, deps)).toEqual([{ name: "steady" }, { name: "guard" }]);
    expect(keywordTotal(state, brute, "retaliate", deps)).toBe(0);
  });

  it("the rule ending (its card leaving play) restores the keyword", () => {
    const game = start(STRAIN.card.id);
    expect(hasKeyword(game.state, game.brute, "steady", deps)).toBe(false);
    const { state, events } = play(game.state, CLEAR_STRAIN.card.id);
    expect(state.villainArea.some((id) => mustInstance(state, id).cardId === STRAIN.card.id)).toBe(false);
    expect(events.filter((e) => e.type === "schemeDefeated")).toEqual([
      { type: "schemeDefeated", instanceId: expect.any(String), cardId: STRAIN.card.id },
    ]);
    expect(keywordsOf(state, game.brute, deps)).toEqual(BRUTE.keywords);
    const stunned = play(state, STUN.card.id).state;
    expect(statusActive(stunned, game.brute, "stunned", deps)).toBe(false);
  });
});
