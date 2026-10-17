/**
 * Rules audit chunk 20 (Appendix IV FAQ: GENERAL QUESTIONS ... QUICKSILVER), proofs that need real cards. Each
 * `it.fails` marks a place the engine does something the FAQ forbids and flips to a failure when it is fixed.
 *
 * RRG 1.8 Appendix IV FAQ, "SUPERHUMAN STRENGTH (#28)" (printed p. 57): "If She-Hulk attacks an enemy that cannot be stunned
 * because it is already stunned or is stalwart, does Superhuman Strength's Forced Interrupt resolve? No. ... the effect
 * cannot resolve and Superhuman Strength is not discarded."
 */
import { activeVillain, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { coreScenario } from "../core/setup.js";
import {
  inst,
  identityOf,
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
} from "../testing/harness.js";

const vsRhino = () =>
  startCoreGame(coreScenario("rhino", { players: [{ starterDeckId: "core-she-hulk-aggression" }], seed: 21 }));

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
