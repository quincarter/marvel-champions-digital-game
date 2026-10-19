/**
 * docs/phase7-wave10.md §3.18: "attacks against them lose piercing" (`attacksLoseKeywords`), in a real Resistance:
 * Captain America game with Cap's Shield 56143: "Attached character gains retaliate 1 and attacks against them lose
 * piercing." The Shield's constant is registered here, written as the leader's module can write it.
 *
 * RRG 1.8 "Lose" (p. 27): "A lost characteristic cannot be regained while the ability causing it to be lost is in
 * effect, even if a new effect would cause the characteristic to be gained"; "Piercing" (p. 32); "Tough" (p. 44).
 * The piercing attacks are the game's own: Venom 56087 ("[star] Venom's attacks gain piercing", ATK 3, a constant
 * `attacksGainKeywords` of the Dangerous Recruits module) and Tigra's basic attack with Sharp Claws 56005 ("Tigra
 * gets +1 ATK for this attack. Choose: This attack gains overkill. / This attack gains piercing.").
 */

import type { Command, GameEvent, GameState, InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { P1, endTurn, identityOf, inst, patchInstance, stackEncounterDeck } from "../testing/harness.js";
import { WAVE10_DEPS, engageMinion, stagedInPlay } from "../wave10/testing.js";
import { attacksLoseKeywords, constant, gainsKeywordX } from "./abilities.js";
import { validateDefinition } from "./validate.js";
import { inMode } from "./values.js";
import {
  SHIELD_CONSTANT,
  choosing,
  depsWith,
  drive,
  leaderOf,
  shieldGame,
  shieldOf,
  withShieldOn,
  withTough,
} from "./wave10-caps-shield.testing.js";

vi.setConfig({ testTimeout: 120_000 });

const VENOM = "56087";
const CLAWS = "56005";
const CLAWS_INTERRUPT = "56005.sharp-claws-interrupt";
const ADVANCE = "01186"; // Standard set: no boost icon, no Boost ability
const DEFEND = "56193"; // Defend Hell's Kitchen, a side scheme of the Hell's Kitchen set
const SETS = { modularSetIds: ["new_avengers", "defenders", "hells_kitchen"] } as const;

/** "Attached character gains retaliate 1 and attacks against them lose piercing." As the real module scripts it. */
const CONSTANT = WAVE10_DEPS.abilities[SHIELD_CONSTANT]!;
/** The Shield without the loss, as a control. */
const RETALIATE_ONLY = constant(gainsKeywordX("retaliate", 1, { hostOfSelf: true }));
const DEPS = depsWith({ [SHIELD_CONSTANT]: CONSTANT });
const DEPS_CONTROL = depsWith({ [SHIELD_CONSTANT]: RETALIATE_ONLY });

const hero = (s: GameState) => identityOf(s, P1);
const pierced = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "statusRemoved" && e.status === "tough" && e.reason === "piercing");
const venomAttacks = (state: GameState, events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "attackResolved" && inst(state, e.enemyInstanceId).cardId === VENOM);

describe("§3.18 the DSL surface", () => {
  it("builds the rule, and the Shield's constant is a valid definition", () => {
    expect(attacksLoseKeywords(["piercing"], { target: { hostOfSelf: true } })).toEqual({
      rules: [{ kind: "attacksLoseKeywords", keywords: ["piercing"], target: { hostOfSelf: true } }],
    });
    expect(
      attacksLoseKeywords(["piercing", "ranged"], { target: { self: true }, while: inMode("expert") }).rules?.[0],
    ).toEqual({
      kind: "attacksLoseKeywords",
      keywords: ["piercing", "ranged"],
      target: { self: true },
      while: { kind: "inMode", mode: "expert" },
    });
    expect(validateDefinition(CONSTANT)).toEqual([]);
  });

  it("builds and validates an attacker-scoped loss (docs/phase7-wave11-scenarios.md §S7 E19)", () => {
    const part = attacksLoseKeywords(["ranged"], { attacker: { hostOfSelf: true } });
    expect(part).toEqual({
      rules: [{ kind: "attacksLoseKeywords", keywords: ["ranged"], attacker: { hostOfSelf: true } }],
    });
    expect(validateDefinition(constant(part))).toEqual([]);
    expect(
      attacksLoseKeywords(["piercing"], { target: { self: true }, attacker: { categories: ["villain"] } }).rules?.[0],
    ).toEqual({
      kind: "attacksLoseKeywords",
      keywords: ["piercing"],
      target: { self: true },
      attacker: { categories: ["villain"] },
    });
  });

  it("the validator refuses no keyword, a repeated one, a character keyword and no target", () => {
    const at = "definition.trigger.rules[0]";
    expect(validateDefinition(constant(attacksLoseKeywords([], { target: { self: true } })))).toEqual([
      `${at}: attacksLoseKeywords names at least one attack keyword`,
    ]);
    expect(
      validateDefinition(constant(attacksLoseKeywords(["piercing", "piercing"], { target: { self: true } }))),
    ).toEqual([`${at}: attacksLoseKeywords names each keyword once`]);
    expect(
      validateDefinition(constant(attacksLoseKeywords(["guard" as "piercing"], { target: { self: true } }))),
    ).toEqual([
      `${at}: attacksLoseKeywords takes piercing, ranged or overkill, not "guard" (a character's own keyword is lost with losesKeyword)`,
    ]);
    expect(validateDefinition(constant(attacksLoseKeywords(["piercing"], {})))).toEqual([
      `${at}: attacksLoseKeywords names the attacked character (target) or the attacker (attacker)`,
    ]);
    expect(validateDefinition(constant(attacksLoseKeywords(["piercing"], { target: {} })))).toEqual([
      `${at}: attacksLoseKeywords names the attacked character (target) or the attacker (attacker)`,
    ]);
  });
});

describe("Cap's Shield (56143) on Tigra with a tough status card: Venom (56087, ATK 3, attacks gain piercing) attacks", () => {
  /**
   * Tigra holds the Shield and one tough card, Venom is engaged with her, and Captain America is stunned, so his own
   * attack in the villain phase is not made and Venom's is the first to reach the tough card. The encounter deck is
   * stacked with cards that print no boost icon and no Boost ability.
   */
  const venomAttack = (deps: typeof DEPS) => {
    const base = shieldGame(deps, SETS);
    const leader = leaderOf(base);
    const quiet = patchInstance(base, leader, { statuses: { ...inst(base, leader).statuses, stunned: 1 } });
    const held = withTough(withShieldOn(quiet, hero(quiet)), hero(quiet), 1);
    const state = stackEncounterDeck(engageMinion(held, VENOM, "venom"), ADVANCE, ADVANCE, DEFEND);
    return { before: state, ...drive(deps, state, endTurn(P1)) };
  };

  it("his attack loses piercing against her: the tough card stays for the attack and absorbs it", () => {
    const { before, state: after, events } = venomAttack(DEPS);
    expect(venomAttacks(after, events)).toMatchObject([
      { baseAtk: 3, boostIcons: 0, damageDealt: 3, targetInstanceId: hero(before) },
    ]);
    expect(pierced(events)).toEqual([]);
    expect(inst(after, hero(after)).damage).toBe(0);
    // Used up by the attack it absorbed (RRG 1.8 "Tough", p. 44), not discarded by piercing.
    expect(inst(after, hero(after)).statuses.tough).toBe(0);
    expect(events.filter((e) => e.type === "statusRemoved" && e.status === "tough")).toMatchObject([
      { instanceId: hero(before), reason: "preventedDamage" },
    ]);
    // Her retaliate 1 answered Venom, and the Shield is still hers.
    expect(inst(after, "venom" as InstanceId).damage).toBe(1);
    expect(inst(after, shieldOf(after)).attachedTo).toBe(hero(after));
  });

  it("the control, the Shield without the loss: the same attack discards the tough card first and deals its 3", () => {
    const { before, state: after, events } = venomAttack(DEPS_CONTROL);
    expect(venomAttacks(after, events)).toMatchObject([{ baseAtk: 3, boostIcons: 0, damageDealt: 3 }]);
    expect(pierced(events)).toMatchObject([{ instanceId: hero(before) }]);
    expect(inst(after, hero(after)).damage).toBe(3);
  });
});

describe("Cap's Shield (56143) on Captain America with a tough status card: Tigra's piercing basic attack", () => {
  const attackWithClaws = (deps: typeof DEPS) => {
    const claws = stagedInPlay(shieldGame(deps), CLAWS, { attach: true });
    const state = withTough(claws.state, leaderOf(claws.state), 1);
    const attack: Command = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: hero(state),
      targetInstanceId: leaderOf(state),
    };
    const pick = choosing({ accept: [CLAWS_INTERRUPT], label: /piercing/i });
    return { ...drive(deps, state, attack, pick), before: state };
  };

  it("it does not strip his tough card: the card absorbs the 3 damage, and he retaliates", () => {
    const { before, state: after, events } = attackWithClaws(DEPS);
    const leader = leaderOf(before);
    expect(pierced(events)).toEqual([]);
    expect(inst(after, leader).damage).toBe(inst(before, leader).damage);
    expect(inst(after, leader).statuses.tough).toBe(0);
    expect(inst(after, hero(after)).damage).toBe(1);
  });

  it("without the loss it does: the tough card is discarded first and he takes 3", () => {
    const { before, state: after, events } = attackWithClaws(DEPS_CONTROL);
    const leader = leaderOf(before);
    expect(pierced(events)).toMatchObject([{ instanceId: leader }]);
    expect(inst(after, leader).damage).toBe(inst(before, leader).damage + 3);
  });
});
