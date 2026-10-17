/**
 * Rules audit chunk 16 (Glossary: TEXT BOX ... VICTORY X). Audit proofs only: each `it.fails` marks a place the engine
 * does something an official source forbids, and flips to a failure when it is fixed.
 *
 * "Then" (RRG 1.8 "Then", p. 44): "If the pre-'then' text of an effect does not fully resolve, the post-'then' text
 * does not attempt to resolve." Nebula's Combat Protocols reads "resolve the Special ability on each technique upgrade
 * you control, then discard each technique upgrade resolved this way". FFG Game Rules Specialist (Alex), October 18,
 * 2024, "Latest FFG Rulings post RRG 1.6" ruling 26 (3): when the technique's ability is replaced by a stunned status
 * card, "it does not get discarded". The script (`wave4/nebu/nebula-kit.ts` 22001a) admits `resolveSpecialsOf` is
 * "always fully resolved with the current engine", so the technique is discarded whatever happened to its Special.
 */
import { activeVillain } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  playerOf,
  runWith,
  settle,
  toHero,
  P1,
} from "../testing/harness.js";
import { WAVE4_DEPS } from "../wave4/index.js";
import { playFromHand, startWave4Game } from "../wave4/testing.js";
import { nebulaScenario } from "../wave4/nebu/support.js";

describe("Combat Protocols (22001a) with a technique whose Special is replaced by a stunned status card", () => {
  it("Weapons Master (22007) with Nebula stunned: its (attack) Special is replaced by the stun, so it is not discarded (FFG ruling Oct 18, 2024 #26 (3))", () => {
    const hero = runWith(WAVE4_DEPS, startWave4Game(nebulaScenario("rhino", { seed: 9 })), toHero());
    const identity = identityOf(hero, P1);
    const { state: withTech, id: tech } = playFromHand(hero, "22007", 1);
    const stunned = patchInstance(withTech, identity, {
      statuses: { ...inst(withTech, identity).statuses, stunned: 1 },
    });
    const villain = activeVillain(stunned).instanceId;
    const damageBefore = inst(stunned, villain).damage;
    const after = settle(runWith(WAVE4_DEPS, stunned, endTurn()), firstLegal, undefined, WAVE4_DEPS);
    // Control: the Special was replaced, so the villain took none of its 4 damage ...
    expect(inst(after, villain).damage - damageBefore).toBeLessThan(4);
    // ... and the technique must stay in play.
    expect(playerOf(after, P1).discard).not.toContain(tech);
  });

  it("two Weapons Master with Nebula stunned: the first Special is replaced (stays), the second resolves (discarded)", () => {
    const hero = runWith(WAVE4_DEPS, startWave4Game(nebulaScenario("rhino", { seed: 9 })), toHero());
    const identity = identityOf(hero, P1);
    const { state: one, id: first } = playFromHand(hero, "22007", 1);
    const { state: two, id: second } = playFromHand(one, "22007", 1);
    const stunned = patchInstance(two, identity, { statuses: { ...inst(two, identity).statuses, stunned: 1 } });
    const villain = activeVillain(stunned).instanceId;
    const damageBefore = inst(stunned, villain).damage;
    const after = settle(runWith(WAVE4_DEPS, stunned, endTurn()), firstLegal, undefined, WAVE4_DEPS);
    const discarded = [first, second].filter((id) => playerOf(after, P1).discard.includes(id));
    expect(discarded).toHaveLength(1);
    expect(inst(after, identity).statuses.stunned ?? 0).toBe(0);
    expect(inst(after, villain).damage - damageBefore).toBeGreaterThan(0);
  });
});
