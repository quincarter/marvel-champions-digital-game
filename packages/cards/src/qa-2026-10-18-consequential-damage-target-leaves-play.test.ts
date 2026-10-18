/**
 * RRG 1.8 "Consequential Damage" (p. 13), proved on a real card: when an attack's target leaves play before the attack
 * deals damage, the attacker takes no consequential damage. Iron Fist (09014) in a real Rhino game
 * (`testing/qa-bench.ts`).
 */
import { remainingHitPoints, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { P1, inst, patchInstance } from "./testing/harness.js";
import { drive, intoPlay, rhino, withPatrolMinion } from "./testing/qa-bench.js";

const IRON_FIST = "09014";

describe("Consequential damage when the basic attack's target leaves play (RRG 1.8 'Consequential Damage', p. 13)", () => {
  it("Iron Fist's interrupt defeats the attacked minion: the attack aborts and he takes no consequential damage", () => {
    const withMinion = withPatrolMinion(rhino());
    const minion = withMinion.players
      .find((p) => p.playerId === P1)!
      .playArea.find((id) => withMinion.instances[id]!.engagedWith === P1)!;
    const placed = intoPlay(withMinion, IRON_FIST, { mystic: 2 });
    const fist: InstanceId = placed.id;
    // One hit point left: the interrupt's 1 damage defeats the minion before the basic attack deals any.
    const hp = remainingHitPoints(placed.state, minion)!;
    const staged = patchInstance(placed.state, minion, { damage: inst(placed.state, minion).damage + hp - 1 });
    const done = drive(
      staged,
      { type: "basicAttack", playerId: P1, attackerInstanceId: fist, targetInstanceId: minion },
      { use: ["iron-fist-interrupt"] },
    );
    expect(done.accepted).toBe(true);
    // Staging sanity: the interrupt was used, the minion is gone and Iron Fist exhausted.
    expect(inst(done.state, fist).counters.mystic).toBe(1);
    expect(done.state.players.find((q) => q.playerId === P1)!.playArea).not.toContain(minion);
    expect(inst(done.state, fist).exhausted).toBe(true);
    // The RRG's own example: no consequential damage. Actual: 1.
    expect(inst(done.state, fist).damage).toBe(0);
  });
});
