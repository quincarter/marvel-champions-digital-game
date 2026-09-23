/**
 * docs/phase7-wave3.md §3.37, `MainSchemeStage.completionLoses`: The Missing Milano 1B (16082b) and Lost in the
 * Museum 2B (16083b) print "Forced Interrupt: When the last threat is removed from this scheme, advance to stage
 * 2A/3A (the players win by advancing). If this stage is completed, the players lose the game." Neither is the
 * scenario's last stage (The Great Escape 3B is), so completing either by ordinary threat placement — not by the
 * scripted "last threat removed" path, which is *leaving* the stage, not completing it (RRG 1.8 p. 27) — must
 * lose the game instead of advancing to the next stage.
 *
 * A new file rather than an addition to `escape-the-museum.test.ts`: another agent may be editing that file and
 * `escape-the-museum.ts` concurrently.
 */
import type { GameState } from "@mc/engine";
import { firstLegal, identityOf, P1, patchInstance, settle, toHero } from "../../testing/harness.js";
import { wave3Scenario } from "../setup.js";
import { runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";

const escapeTheMuseum = () =>
  startWave3Game(
    wave3Scenario("escape-the-museum", {
      players: [{ starterDeckId: "groot-protection" }],
      seed: 2026,
    }),
  );

describe("The Missing Milano 1B (16082b, MainSchemeStage.completionLoses)", () => {
  it("completing stage 1 by ordinary threat placement loses the game instead of advancing to Lost in the Museum", () => {
    const state = escapeTheMuseum();
    expect(state.mainScheme.stageIndex).toBe(0);
    const scheme = state.mainScheme.instanceId;
    // startingThreat 7, targetThreat 11, acceleration 1 for 1 hero (16082b): one below target, so step one's own
    // acceleration pushes it to target through the real event system (a direct patch to the target value would
    // not fire the completion check at all, since that check runs where threat is *placed*, not on every read) —
    // same shape as Hostile Takeover 1B (`packages/cards/src/wave1/gob/risky-business.test.ts`) and Kang's
    // Arrival 1B (`packages/cards/src/wave2/toafk/kang.test.ts`).
    const primed = patchInstance(state, scheme, { threat: 10 });
    const settled = settle(runWave3(primed, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE3_DEPS);
    expect(settled.outcome).toMatchObject({ result: "loss", reason: "mainSchemeCompleted" });
    // Not advanced: stage 1 completing is a loss, not a trip to stage 2 (Lost in the Museum).
    expect(settled.mainScheme.stageIndex).toBe(0);
  });

  it("leaving the stage by the card's own 'last threat removed' Forced Interrupt is not completing it, and still advances (RRG 1.8 p. 27)", () => {
    const hero = runWave3(escapeTheMuseum(), toHero());
    const scheme = hero.mainScheme.instanceId;
    const zeroed = patchInstance(hero, scheme, { threat: 1 });
    const identity = identityOf(zeroed, P1);
    const readied = patchInstance(zeroed, identity, { exhausted: false });
    const settled: GameState = settle(
      runWave3(readied, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: scheme,
      }),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(settled.outcome).toBeNull();
    expect(settled.mainScheme.stageIndex).toBe(1);
  });
});
