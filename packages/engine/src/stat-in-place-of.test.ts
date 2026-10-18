/**
 * docs/phase7-wave11.md §3.10: "Your hero gets +1 DEF. Use your DEF in place of your THW and ATK. (Ignore any modifiers
 * to your THW and ATK.)" (The Best Offense..., `fne` 60052), as `RuleSpec statInPlaceOf { target, stats: ["thw",
 * "atk"], use: "def" }`, read inside `characterStat` / `characterProfile`.
 *
 * Sources: ruling June 25, 2026 - Ruling 3 (marvel-champions-rulings-post-rrg-1-7.md): with DEF 8, a basic thwart
 * thwarts for 8, Go All Out uses 8 for its THW, ATK and DEF, As One! uses 8 in place of ATK. So every read of the
 * hero's THW and ATK, not only the basic powers. RRG 1.8 "Thwart" (p. 43), "Attack" (p. 8), "Modifiers" (p. 29).
 *
 * Synthetic cards. The stub hero has THW 2, ATK 2, DEF 2; a "+1 DEF" support makes it DEF 3, and The Best Offense's
 * own +1 makes it DEF 4. The stub ally has THW 1, ATK 2.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { characterProfile, characterStat, mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSupport } from "./testing/fixtures.js";
import { ALLY } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const yourHero = { categories: ["identity"], controller: "you" } as const;

/** "Your hero gets +1 DEF. Use your DEF in place of your THW and ATK." */
const BEST_OFFENSE_ABILITY = stubAbility(
  "best-offense.constant",
  def({
    trigger: {
      kind: "constant",
      modifiers: [{ stat: "def", amount: 1, target: yourHero }],
      rules: [{ kind: "statInPlaceOf", target: yourHero, stats: ["thw", "atk"], use: "def" }],
    },
    effects: [],
  }),
);
const BEST_OFFENSE = stubSupport({ id: "best-offense", cost: 0, abilities: [BEST_OFFENSE_ABILITY.ref] });
/** "Your hero gets +1 DEF", so the hero is DEF 3 before The Best Offense. */
const DEF_UP_ABILITY = stubAbility(
  "def-up.constant",
  def({ trigger: { kind: "constant", modifiers: [{ stat: "def", amount: 1, target: yourHero }] }, effects: [] }),
);
const DEF_UP = stubSupport({ id: "def-up", cost: 0, abilities: [DEF_UP_ABILITY.ref] });
/** A "+2 ATK" upgrade and a "+2 THW" one: modifiers The Best Offense ignores. */
const ATK_UP_ABILITY = stubAbility(
  "atk-up.constant",
  def({ trigger: { kind: "constant", modifiers: [{ stat: "atk", amount: 2, target: yourHero }] }, effects: [] }),
);
const ATK_UP = stubSupport({ id: "atk-up", cost: 0, abilities: [ATK_UP_ABILITY.ref] });
const THW_UP_ABILITY = stubAbility(
  "thw-up.constant",
  def({ trigger: { kind: "constant", modifiers: [{ stat: "thw", amount: 2, target: yourHero }] }, effects: [] }),
);
const THW_UP = stubSupport({ id: "thw-up", cost: 0, abilities: [THW_UP_ABILITY.ref] });
/** Cross-Examination-style "equal to your ATK": "Action: Deal damage to the villain equal to your hero's ATK." */
const EQUAL_TO_ATK_ABILITY = stubAbility(
  "equal-to-atk.action",
  def({
    trigger: { kind: "action" },
    effects: [
      {
        kind: "dealDamage",
        target: { kind: "villain" },
        amount: { kind: "stat", of: { kind: "identityOf", player: { kind: "controller" } }, stat: "atk" },
      },
    ],
  }),
);
const EQUAL_TO_ATK = stubSupport({ id: "equal-to-atk", cost: 0, abilities: [EQUAL_TO_ATK_ABILITY.ref] });

/** Go All Out-shaped: "Deal damage to the villain equal to your THW + ATK + DEF" (ruling June 25, 2026 - Ruling 3). */
const yourIdentity = { kind: "identityOf", player: { kind: "controller" } } as const;
const ALL_OUT_ABILITY = stubAbility(
  "all-out.action",
  def({
    trigger: { kind: "action" },
    effects: [
      {
        kind: "dealDamage",
        target: { kind: "villain" },
        amount: {
          kind: "sum",
          values: [
            { kind: "stat", of: yourIdentity, stat: "thw" },
            { kind: "stat", of: yourIdentity, stat: "atk" },
            { kind: "stat", of: yourIdentity, stat: "def" },
          ],
        },
      },
    ],
  }),
);
const ALL_OUT = stubSupport({ id: "all-out", cost: 0, abilities: [ALL_OUT_ABILITY.ref] });
/** Spider Claws-shaped (`silk` 52011): "When your hero attacks, it gets +2 ATK for this attack" (`modifyAttack.atkBonus`). */
const CLAWS_ABILITY = stubAbility(
  "claws.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "attack", playerIs: "controller" } },
    effects: [{ kind: "modifyAttack", atkBonus: { kind: "const", value: 2 } }],
  }),
);
const CLAWS = stubSupport({ id: "claws", cost: 0, abilities: [CLAWS_ABILITY.ref] });
/** The rule under a `while` that reads no stat: "While you control an ally, use your DEF in place of your THW." */
const WHILE_ABILITY = stubAbility(
  "while-ally.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [
        {
          kind: "statInPlaceOf",
          target: yourHero,
          stats: ["thw"],
          use: "def",
          while: { kind: "exists", query: { categories: ["ally"], controller: "you" } },
        },
      ],
    },
    effects: [],
  }),
);
const WHILE_ALLY = stubSupport({ id: "while-ally", cost: 0, abilities: [WHILE_ABILITY.ref] });

const SUPPORTS = [BEST_OFFENSE, DEF_UP, ATK_UP, THW_UP, EQUAL_TO_ATK, ALL_OUT, CLAWS, WHILE_ALLY];
const deps = depsOf(
  BEST_OFFENSE_ABILITY,
  DEF_UP_ABILITY,
  ATK_UP_ABILITY,
  THW_UP_ABILITY,
  EQUAL_TO_ATK_ABILITY,
  ALL_OUT_ABILITY,
  CLAWS_ABILITY,
  WHILE_ABILITY,
);
const use = (state: GameState, card: { readonly id: string }, abilityId: (typeof ALL_OUT_ABILITY)["ref"]["id"]) =>
  run(state, [{ type: "useAbility", playerId: P1, cardInstanceId: inPlay(state, card), abilityId, payment: [] }]);
const identityOf = (state: GameState) => mustPlayer(state, P1).identity.instanceId;
const inPlay = (state: GameState, card: { readonly id: string }) =>
  mustPlayer(state, P1).playArea.find((id) => mustInstance(state, id).cardId === card.id)!;

function run(state: GameState, commands: readonly Command[]): GameState {
  const driven = driveSession(startSession(state), deps, commands);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return driven.session.state;
}

/** P1's first turn in hero form with these cards in play, 10 threat on the main scheme. */
function start(cards: readonly { readonly id: (typeof BEST_OFFENSE)["id"] }[]): GameState {
  let state = gameAtFirstTurn({ cards: SUPPORTS, deps, deck: SUPPORTS.map((card) => card.id) });
  for (const card of cards) state = playerCardIntoPlay(state, card.id).state;
  state = run(state, [{ type: "changeForm", playerId: P1 }]);
  const main = state.mainScheme.instanceId;
  return { ...state, instances: { ...state.instances, [main]: { ...mustInstance(state, main), threat: 10 } } };
}
const threatRemoved = (before: GameState, after: GameState) =>
  mustInstance(before, before.mainScheme.instanceId).threat - mustInstance(after, after.mainScheme.instanceId).threat;
const villainDamage = (state: GameState) => mustInstance(state, state.activeVillainId!).damage;
const thwart = (state: GameState, by: InstanceId = identityOf(state)): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: by,
  schemeInstanceId: state.mainScheme.instanceId,
});
const attack = (state: GameState, by: InstanceId = identityOf(state)): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: by,
  targetInstanceId: state.activeVillainId!,
});

describe("§3.10 `RuleSpec statInPlaceOf`: The Best Offense uses DEF in place of THW and ATK", () => {
  it("control: without it, DEF 3, THW 2, ATK 2; a basic thwart removes 2, a basic attack deals 2", () => {
    const state = start([DEF_UP]);
    const hero = identityOf(state);
    expect(characterProfile(state, hero, deps)).toMatchObject({ thw: 2, atk: 2, def: 3 });
    expect(threatRemoved(state, run(state, [thwart(state)]))).toBe(2);
    expect(villainDamage(run(state, [attack(state)]))).toBe(2);
  });

  it("DEF 3 with The Best Offense: DEF 4, and THW and ATK read 4 through the profile and the single stat", () => {
    const state = start([DEF_UP, BEST_OFFENSE]);
    const hero = identityOf(state);
    expect(characterProfile(state, hero, deps)).toMatchObject({ thw: 4, atk: 4, def: 4 });
    expect(characterStat(state, hero, "thw", deps)).toBe(4);
    expect(characterStat(state, hero, "atk", deps)).toBe(4);
    expect(characterStat(state, hero, "def", deps)).toBe(4);
  });

  it("basic thwart removes 4; basic attack deals 4", () => {
    const state = start([DEF_UP, BEST_OFFENSE]);
    expect(threatRemoved(state, run(state, [thwart(state)]))).toBe(4);
    expect(villainDamage(run(state, [attack(state)]))).toBe(4);
  });

  it("an effect 'equal to your ATK' reads 4", () => {
    const state = start([DEF_UP, BEST_OFFENSE, EQUAL_TO_ATK]);
    const after = run(state, [
      {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: inPlay(state, EQUAL_TO_ATK),
        abilityId: EQUAL_TO_ATK_ABILITY.ref.id,
        payment: [],
      },
    ]);
    expect(villainDamage(after)).toBe(4);
  });

  it("ignores modifiers to THW and ATK: a +2 ATK and a +2 THW upgrade change nothing", () => {
    const state = start([DEF_UP, BEST_OFFENSE, ATK_UP, THW_UP]);
    expect(characterProfile(state, identityOf(state), deps)).toMatchObject({ thw: 4, atk: 4, def: 4 });
    expect(villainDamage(run(state, [attack(state)]))).toBe(4);
    // Control: the same upgrades without The Best Offense do raise them.
    const plain = start([DEF_UP, ATK_UP, THW_UP]);
    expect(characterProfile(plain, identityOf(plain), deps)).toMatchObject({ thw: 4, atk: 4, def: 3 });
  });

  it("only the matching character: an ally the player controls keeps its own THW and ATK", () => {
    const state = playerCardIntoPlay(start([DEF_UP, BEST_OFFENSE]), ALLY.id).state;
    const ally = inPlay(state, ALLY);
    expect(characterProfile(state, ally, deps)).toMatchObject({ thw: 1, atk: 2 });
  });

  it("a Go All Out-shaped THW + ATK + DEF reads DEF for each: 4 + 4 + 4 = 12 (control 2 + 2 + 3 = 7)", () => {
    const state = start([DEF_UP, BEST_OFFENSE, ALL_OUT]);
    expect(villainDamage(use(state, ALL_OUT, ALL_OUT_ABILITY.ref.id))).toBe(12);
    const plain = start([DEF_UP, ALL_OUT]);
    expect(villainDamage(use(plain, ALL_OUT, ALL_OUT_ABILITY.ref.id))).toBe(7);
  });

  it("a Spider Claws-shaped +2 ATK for this attack is ignored: DEF 4 deals 4, not 6", () => {
    const state = start([DEF_UP, BEST_OFFENSE, CLAWS]);
    expect(villainDamage(run(state, [attack(state)]))).toBe(4);
    // Control: without The Best Offense the bonus applies, ATK 2 + 2.
    const plain = start([DEF_UP, CLAWS]);
    expect(characterStat(plain, identityOf(plain), "atk", deps)).toBe(2);
    expect(villainDamage(run(plain, [attack(plain)]))).toBe(4);
    const bare = start([DEF_UP]);
    expect(villainDamage(run(bare, [attack(bare)]))).toBe(2);
  });

  it("`while`: the swap holds only while its condition does", () => {
    const without = start([DEF_UP, WHILE_ALLY]);
    expect(characterProfile(without, identityOf(without), deps)).toMatchObject({ thw: 2, atk: 2, def: 3 });
    const withAlly = playerCardIntoPlay(without, ALLY.id).state;
    expect(characterProfile(withAlly, identityOf(withAlly), deps)).toMatchObject({ thw: 3, atk: 2, def: 3 });
  });
});
