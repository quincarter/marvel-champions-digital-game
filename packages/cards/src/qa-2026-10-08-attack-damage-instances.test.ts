/**
 * Owner ruling of 2026-10-08 on "that attack deals N additional damage" (docs/phase7-wave8.md §4.1 Q53), proved on REAL
 * cards. The rule is the engine's (`packages/engine/src/resolve/attack-ability.ts`, fixtures in the engine's
 * `attack-extra-damage-instances.test.ts`); no card script was rewritten for it, so these tests are what shows the
 * shipped cards moved.
 *
 * **Q53 = A.** The increase modifies the attack, so each instance of damage the attack ability deals gets it. RRG 1.8
 * "Attack (Player Ability Type)" (p. 10): "When an attack ability has its damage increased by another ability, each
 * instance of damage in that attack ability that does not use the word 'additional' is increased by the specified
 * amount"; "'For Each'" (p. 20), whose example is Flurry of Blades.
 *
 * The modifier is Warrior Skill (`wolv` 35016, "Interrupt: When your hero attacks, remove 1 counter from here → that
 * attack deals 1 additional damage"), put into play with its three counters. Each card is played by a real hero in a
 * real Rhino game (`testing/qa-bench.ts`): Dive Bomb by Spider-Man given the AERIAL trait, Flurry of Blades by
 * Psylocke's precon with both blades showing Psi-Katana. 'Port and Punch needs Nightcrawler's pack, which is not in the
 * playable pool yet, and is proved in its own test file (`wave8/ncrawler/nightcrawler/events.test.ts`, "Q53").
 */
import type { GameEvent, GameState, InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { identityOf, inst, patchInstance } from "./testing/harness.js";
import { conjure, intoPlay, playOut, rhino, withTrait } from "./testing/qa-bench.js";
import { engageMinion } from "./wave6/mut_gen/project-wideawake-testing.js";

const WARRIOR_SKILL = "35016";
const SKILL_REF = "35016.warrior-skill-interrupt";
const SANDMAN = "01102"; // Rhino's minion: 4 hit points, no guard.

const villainOf = (state: GameState): InstanceId => state.activeVillainId!;
const codeOf = (state: GameState, id: InstanceId): string => state.instances[id]!.cardId as string;
/** Each instance of damage dealt to `id`, in order. */
const takenBy = (events: readonly GameEvent[], id: InstanceId): number[] =>
  events.flatMap((e) => (e.type === "damageDealt" && e.targetInstanceId === id ? [e.amount] : []));
const attacksMade = (events: readonly GameEvent[]): number =>
  events.filter((e) => e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "attack").length;
/** Warrior Skill in play with its 3 counters when `skilled`. */
const skilled = (state: GameState, on: boolean): GameState =>
  on ? intoPlay(state, WARRIOR_SKILL, { warrior: 3 }).state : state;
const countersLeft = (state: GameState): number | undefined => {
  const skill = Object.values(state.instances).find((i) => (i.cardId as string) === WARRIOR_SKILL && i.faceup);
  return skill?.counters.warrior;
};

describe("Q53: Dive Bomb (17028), 'Deal 7 damage to an enemy. Deal 1 damage to each other enemy.'", () => {
  function diveBomb(withSkill: boolean) {
    const base = skilled(withTrait(rhino(), "AERIAL"), withSkill);
    const minion = engageMinion(base, SANDMAN);
    const given = conjure(minion.state, "17028");
    const villain = villainOf(given.state);
    const done = playOut(given.state, given.id, 4, { target: villain, use: [SKILL_REF] });
    expect(done.accepted).toBe(true);
    return { ...done, villain, minion: minion.id };
  }
  it("as printed: 7 to the enemy, 1 to the other", () => {
    const run = diveBomb(false);
    expect(takenBy(run.events, run.villain)).toEqual([7]);
    expect(takenBy(run.events, run.minion)).toEqual([1]);
  });
  it("with 'that attack deals 1 additional damage': 8 to the enemy and 2 to each other enemy, one attack, one counter", () => {
    const run = diveBomb(true);
    expect(takenBy(run.events, run.villain)).toEqual([8]);
    expect(takenBy(run.events, run.minion)).toEqual([2]);
    expect(attacksMade(run.events)).toBe(1);
    expect(countersLeft(run.state)).toBe(2);
  });
});

describe("Q53: Flurry of Blades (41004), '… For each Psi-Katana you control, choose an enemy and deal 2 damage to it.'", () => {
  function flurry(withSkill: boolean) {
    const base = skilled(rhino(1, "psylocke-justice"), withSkill);
    // Both of her blades showing Psi-Katana (the events count the showing face).
    const blades = inst(base, identityOf(base)).attachments.filter((id) => codeOf(base, id) === "41002a");
    expect(blades).toHaveLength(2);
    const katanas = blades.reduce((s, id) => patchInstance(s, id, { flipped: true }), base);
    const given = conjure(katanas, "41004");
    const villain = villainOf(given.state);
    const done = playOut(given.state, given.id, 3, { target: villain, use: [SKILL_REF] });
    expect(done.accepted).toBe(true);
    return { ...done, villain };
  }
  it("as printed, every pick on the villain: 2, then 2 for each Psi-Katana", () => {
    expect(takenBy(flurry(false).events, villainOf(rhino(1, "psylocke-justice")))).toEqual([2, 2, 2]);
  });
  it("with 'that attack deals 1 additional damage': 3 to each chosen enemy (the RRG's own example)", () => {
    const run = flurry(true);
    expect(takenBy(run.events, run.villain)).toEqual([3, 3, 3]);
    expect(attacksMade(run.events)).toBe(1);
    expect(countersLeft(run.state)).toBe(2);
  });
});
