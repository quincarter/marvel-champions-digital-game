/**
 * Fix proof for `cost-vs-effect-split`: text before a cost arrow is paid even when a stun or confuse status card
 * replaces the labeled ability's effect (FFG ruling April 30, 2026 (2); RRG 1.8 "Cost Arrow Icon", p. 14). Defender of
 * the Nine Realms, Karmic Blast and Cosmic Awareness are proved in rules-audit-05, -36 and -39.
 */
import { describe, expect, it } from "vitest";
import {
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  run,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
} from "../testing/harness.js";
import { startWave5Game, WAVE5_DEPS } from "../wave5/testing.js";
import { ghostSpiderScenario } from "../wave5/sm/ghost-spider/support.js";

describe("Return the Favor (27015) played while stunned", () => {
  it("the discard and reveal (the cost) still happen; the stun card replaces only the 5 damage", () => {
    const state = startWave5Game(ghostSpiderScenario("rhino", { seed: 1 }));
    const given = moveToHand(run(state, toHero(P1)), P1, "27015");
    const [card] = given.ids as [never];
    const me = identityOf(given.state);
    const villain = given.state.villains[0]!.instanceId;
    // Advance (01186) is a treachery: "the villain schemes" resolves on the reveal, so the main scheme gains threat.
    const stacked = patchInstance(stackEncounterDeck(given.state, "01186"), me, {
      statuses: { ...inst(given.state, me).statuses, stunned: 1 },
    });
    const threatBefore = mainThreat(stacked);
    const damageBefore = inst(stacked, villain).damage;
    const after = settle(
      runWith(WAVE5_DEPS, stacked, play(P1, card, payWith(stacked, P1, 0, [card]))),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(mainThreat(after)).toBeGreaterThan(threatBefore);
    expect(inst(after, me).statuses.stunned).toBe(0);
    expect(inst(after, villain).damage).toBe(damageBefore);
    expect(playerOf(after, P1).discard).toContain(card);
  });
});
