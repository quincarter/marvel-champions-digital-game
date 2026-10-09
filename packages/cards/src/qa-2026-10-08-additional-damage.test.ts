/**
 * Owner ruling of 2026-10-08 on "that attack deals N additional damage" (docs/phase7-wave8.md §4.1 Q53 = A), second
 * half: the increase is NOT added again to damage a card itself describes as additional. RRG 1.8 "Additional": the
 * additional damage is a simultaneous modification of the instance it modifies, not an instance of its own (the
 * Repulsor Blast FAQ).
 *
 * The sweep of every shipped card with an attack-labeled "additional damage" clause found each script writes it as an
 * amount on the one attack instruction (a computed amount, so one instance), never as a second `dealDamage`, so no
 * script needed `{ additional: true }`. Repulsor Blast (core 01031) is proved here because the RRG names it: "Deal 1
 * damage to an enemy and discard the top 5 cards of your deck. For each printed [energy] resource discarded this way,
 * deal 2 additional damage to that enemy." With Warrior Skill (35016, "that attack deals 1 additional damage") it is
 * ONE instance of 1 + 2 per energy + 1, not one instance of 1 + 1 and a second of 2 per energy + 1.
 */
import { cardId } from "@mc/content";
import type { GameEvent, InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { P1, patchInstance, playerOf } from "./testing/harness.js";
import { conjure, intoPlay, playOut, rhino } from "./testing/qa-bench.js";

const WARRIOR_SKILL = "35016";
const SKILL_REF = "35016.warrior-skill-interrupt";
const REPULSOR_BLAST = "01031";
const ENERGY = "01032"; // Supersonic Punch: printed [energy] resource.
const NOT_ENERGY = "01030"; // War Machine: printed [wild] resource.

/** Each instance of damage dealt to `id`, in order. */
const takenBy = (events: readonly GameEvent[], id: InstanceId): number[] =>
  events.flatMap((e) => (e.type === "damageDealt" && e.targetInstanceId === id ? [e.amount] : []));

/** Iron Man plays Repulsor Blast with `energy` printed-energy cards among the top 5 of his deck. */
function repulsorBlast(energy: number, withSkill: boolean) {
  const start = rhino(1, "core-iron-man-aggression");
  // Relabel the top 5 cards of the deck (a real deck, any cards) as energy or non-energy resources.
  const stacked = playerOf(start, P1)
    .deck.slice(0, 5)
    .reduce((s, id, i) => patchInstance(s, id, { cardId: cardId(i < energy ? ENERGY : NOT_ENERGY) }), start);
  const skilled = withSkill ? intoPlay(stacked, WARRIOR_SKILL, { warrior: 3 }).state : stacked;
  const given = conjure(skilled, REPULSOR_BLAST);
  const villain = given.state.activeVillainId!;
  const done = playOut(given.state, given.id, 1, { target: villain, use: [SKILL_REF] });
  expect(done.accepted).toBe(true);
  return { ...done, villain };
}

describe("Q53: Repulsor Blast (01031), additional damage is not an instance of its own", () => {
  it("control, as printed: 1 damage, plus 2 additional per energy card, all as one instance", () => {
    for (const energy of [0, 2]) {
      const run = repulsorBlast(energy, false);
      expect(takenBy(run.events, run.villain)).toEqual([1 + 2 * energy]);
    }
  });
  it("with 'that attack deals 1 additional damage': the bonus lands once, on the base instance (2 energy cards)", () => {
    const run = repulsorBlast(2, true);
    // 1 + 1 (Warrior Skill) + 2 * 2 = 6, one instance: not 7 (+1 again on the additional damage) and not [2, 5].
    expect(takenBy(run.events, run.villain)).toEqual([6]);
  });
  it("with no energy card discarded there is no additional damage and the bonus still lands once", () => {
    const run = repulsorBlast(0, true);
    expect(takenBy(run.events, run.villain)).toEqual([2]);
  });
});
