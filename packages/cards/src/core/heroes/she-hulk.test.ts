import { activeVillain, remainingHitPoints, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { coreScenario } from "../setup.js";
import {
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  run,
  settle,
  startCoreGame,
  toHero,
} from "../../testing/harness.js";

const vsRhino = () =>
  startCoreGame(coreScenario("rhino", { players: [{ starterDeckId: "core-she-hulk-aggression" }], seed: 21 }));

// RRG 1.8 Appendix IV FAQ, "SUPERHUMAN STRENGTH (#28)" (printed p. 57): "If She-Hulk attacks an enemy that cannot be
// stunned because it is already stunned or is stalwart, does Superhuman Strength's Forced Interrupt resolve? No. ...
// the effect cannot resolve and Superhuman Strength is not discarded."
describe("Superhuman Strength (01028) against an enemy that cannot be stunned (FAQ p. 57)", () => {
  it("an already stunned villain: the upgrade is not discarded", () => {
    const given = moveToHand(vsRhino(), P1, "01028");
    const [strength] = given.ids as [InstanceId];
    const hero = settle(run(given.state, toHero()));
    const villain = activeVillain(hero).instanceId;
    const stunned = patchInstance(hero, villain, { statuses: { ...inst(hero, villain).statuses, stunned: 1 } });
    const strong = run(stunned, play(P1, strength, payWith(stunned, P1, 2, given.ids)));
    const after = settle(
      run(strong, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(strong),
        targetInstanceId: villain,
      }),
    );
    expect(inst(after, villain).damage).toBe(5);
    expect(playerOf(after, P1).discard).not.toContain(strength);
  });
});

// FFG rulings May 25, 2023 - Ruling 13 and May 30, 2023 - Ruling 14 (third bullet): an attacked enemy that leaves play
// leaves the Forced Response with no valid target.
describe("Superhuman Strength (01028) when the attacked enemy leaves play (FFG ruling May 25, 2023 - Ruling 13; May 30, 2023 - Ruling 14 third bullet)", () => {
  it("She-Hulk's attack defeats the enemy: the Forced Response has no valid target, does not initiate, and the upgrade is not discarded", () => {
    const given = moveToHand(vsRhino(), P1, "01028");
    const [strength] = given.ids as [InstanceId];
    const hero = settle(run(given.state, toHero()));
    const villainId = activeVillain(hero).instanceId;
    // Leave the villain 1 hit point so She-Hulk's 5 ATK defeats it (a minion would do too; the villain keeps the staging short).
    const hp = remainingHitPoints(hero, villainId)!;
    const nearDead = patchInstance(hero, villainId, { damage: inst(hero, villainId).damage + hp - 1 });
    const strong = run(nearDead, play(P1, strength, payWith(nearDead, P1, 2, given.ids)));
    const after = settle(
      run(strong, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(strong),
        targetInstanceId: villainId,
      }),
    );
    // Staging sanity: the enemy took the damage (the villain advanced to its next stage or the game ended).
    expect(
      inst(after, villainId).damage === 0 || after.outcome !== undefined || after.activeVillainId !== villainId,
    ).toBe(true);
    expect(playerOf(after, P1).discard).not.toContain(strength);
  });
});
