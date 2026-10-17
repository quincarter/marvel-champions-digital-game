/**
 * Rules audit chunk 14 (Glossary: RESTRICTED ... STANDARD SET). Audit proofs only: each `it.fails` marks a place the
 * engine does something an official source forbids, and flips to a failure when it is fixed.
 *
 * Stalwart / "cannot be confused" (Magneto's Helmet, 32147): RRG 1.8 "Stalwart" (p. 40) removes the held stunned and
 * confused status cards when a character gains the stalwart keyword, and "Status Cards" (p. 41) says only that with a
 * "cannot be stunned" ability "stunned status cards cannot be placed on that character"; the RRG is silent on one
 * already held. FFG Game Rules Specialist (Alex), February 15, 2024, "Latest FFG Rulings post RRG 1.5" ruling 145:
 * "If a Steady Magneto has 1 confused status card on him when Magneto's Helmet attaches to him, the confused status
 * card remains on him unless he gains Stalwart." The engine (`clearForbiddenStatuses`, `resolve/state-checks.ts`)
 * sheds the held card as soon as the helmet applies.
 */
import { type GameState, type InstanceId, activeVillain } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { inst, patchInstance, runWith, toHero, P1 } from "../testing/harness.js";
import { WAVE6_DEPS } from "../wave6/index.js";
import { magnetoGame } from "../wave6/mut_gen/magneto-testing.js";
import { attachToHost } from "../wave6/mut_gen/project-wideawake-testing.js";

const villain = (state: GameState): InstanceId => activeVillain(state).instanceId;

describe("Stalwart (RRG 1.8 p. 40) and 'cannot be confused' with a status card already held", () => {
  it.fails("Magneto holding a confused card when Magneto's Helmet attaches keeps it (FFG ruling 145, Feb 15, 2024)", () => {
    const base = magnetoGame();
    const confused = patchInstance(base, villain(base), {
      statuses: { ...inst(base, villain(base)).statuses, confused: 1 },
    });
    const { state: helmeted } = attachToHost(confused, "32147", villain(confused));
    // Any command runs the state checks (changing form touches nothing on Magneto).
    const after = runWith(WAVE6_DEPS, helmeted, toHero(P1));
    expect(inst(after, villain(after)).attachments.length).toBeGreaterThan(0);
    expect(inst(after, villain(after)).statuses.confused).toBe(1);
  });
});
