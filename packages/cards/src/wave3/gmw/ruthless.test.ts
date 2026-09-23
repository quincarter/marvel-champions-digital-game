import type { GameState } from "@mc/engine";
import { endTurn, instancesOf, patchInstance, stackEncounterDeck, toHero } from "../../testing/harness.js";
import { driveEvents } from "../../testing/staging.js";
import { wave3Scenario } from "../setup.js";
import { runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";

/**
 * Ruthless (16102, `gmw/ruthless.ts`) — one of Nebula's own encounter set treacheries.
 *
 * Both tests reset the main scheme's threat to 0 (`patchInstance`, the same surgery `gmw/nebula.test.ts` uses) so
 * the villain phase's own step-one activation plus this card's own triggered one can't push The Art of Evasion 1B
 * to completion mid-test and confound the evasion count with Warp Drive Initiated 2A's own "+2 evasion counters"
 * When Revealed. Both stack three encounter cards, not the usual two: `"01186"` (a filler, `docs/card-scripting-
 * process.md`'s `stackSetAsideBehindBoost`'s bare cousin used throughout `gmw/nebula.test.ts`) absorbs step one's
 * own boost draw, `"16102"` is what's actually revealed, and a second `"01186"` absorbs the boost card Ruthless's
 * own triggered scheme/attack draws — without it the next real deck card (Barrel Roll, 16100, at this seed) would
 * flip as that boost and place its own unrelated evasion counter, an equally real confound.
 */
const nebula = () =>
  startWave3Game(wave3Scenario("nebula", { players: [{ starterDeckId: "groot-protection" }], seed: 2026 }));

const evasionCounters = (state: GameState): number => {
  const [ship] = instancesOf(state, "16093");
  return state.instances[ship!]!.counters.evasion ?? 0;
};

describe("Ruthless (16102)", () => {
  it("When Revealed (Alter-Ego): Nebula schemes, and places 1 evasion counter on Nebula's Ship since threat is placed by that activation (16102.when-revealed-alter-ego)", () => {
    const state = nebula(); // default post-setup form is alter-ego
    const reset = patchInstance(state, state.mainScheme.instanceId, { threat: 0 });
    const before = evasionCounters(reset);
    const staged = stackEncounterDeck(reset, "01186", "16102", "01186");
    const { state: after } = driveEvents(WAVE3_DEPS, staged, endTurn());
    // +1 from Nebula's Ship's own unconditional "villain phase begins" Forced Interrupt (16093), +1 from
    // Ruthless's own conditional evasion counter (verified real, not a no-op, by the exact expected total).
    expect(evasionCounters(after)).toBe(before + 2);
  });

  it("When Revealed (Hero): Nebula attacks you, and places 1 evasion counter on Nebula's Ship since damage is dealt by that activation (16102.when-revealed-hero)", () => {
    const state = runWave3(nebula(), toHero());
    const reset = patchInstance(state, state.mainScheme.instanceId, { threat: 0 });
    const before = evasionCounters(reset);
    const staged = stackEncounterDeck(reset, "01186", "16102", "01186");
    const { state: after } = driveEvents(WAVE3_DEPS, staged, endTurn());
    expect(evasionCounters(after)).toBe(before + 2);
  });
});
