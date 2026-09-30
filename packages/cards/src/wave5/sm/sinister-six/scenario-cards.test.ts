import { cardId } from "@mc/content";
import { createGame, undefeatedVillains, type GameSetupConfig, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  patchInstance,
  settle,
  toHero,
} from "../../../testing/harness.js";
import { runWave5, WAVE5_DEPS } from "../../testing.js";
import { wave5Scenario, type Wave5ScenarioOptions } from "../../setup.js";

/**
 * Light at the End (`sm` 27102a Trap! / 27102b Chase!; MC27 p. 15, docs/phase7-wave5.md §1.5): "Permanent. Hinder
 * 10[per_hero].\nThe players cannot win unless they escape.\nForced Interrupt: When the last threat is removed from
 * this scheme, resolve the 'Ambush!' ability on the main scheme. Flip this card. (The players can escape on the
 * other side.)" / Chase!'s own "Forced Interrupt: When the last threat is removed from this scheme, the players
 * escape and win the game."
 */

function sinisterSixGame(
  players: Wave5ScenarioOptions["players"],
  overrides: Partial<Wave5ScenarioOptions> = {},
): GameState {
  const config: GameSetupConfig = wave5Scenario("sinister-six", { seed: 1, players, ...overrides });
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
  return settle(runWave5(settled, toHero(P1)), firstLegal, undefined, WAVE5_DEPS);
}

/** A basic thwart from the identity against `target`, readying it first (test-only surgery, `defeatWithAttack`'s own shape for schemes). */
function thwart(state: GameState, target: InstanceId): GameState {
  const identity = identityOf(state, P1);
  const readied = patchInstance(state, identity, { exhausted: false });
  return settle(
    runWave5(readied, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identity,
      schemeInstanceId: target,
    }),
    firstLegal,
    undefined,
    WAVE5_DEPS,
  );
}

describe("27102a.light-at-the-end-forced-interrupt (Trap!)", () => {
  it('when the last threat is removed, resolves "Ambush!" on the main scheme (a set-aside villain enters, taking the active counter) and flips to Chase! (27102b)', () => {
    let state = sinisterSixGame([{ starterDeckId: "ghost-spider" }]);
    const light = instancesOf(state, "27102a")[0]!;
    const originalVillainInstanceIds = new Set(undefeatedVillains(state).map((v) => v.instanceId)); // 2 (players+1)
    state = patchInstance(state, light, { threat: 1 });
    const after = thwart(state, light);
    expect(inst(after, light).cardId).toBe(cardId("27102b")); // flipped to Chase!
    const inPlayAfter = undefeatedVillains(after);
    expect(inPlayAfter).toHaveLength(originalVillainInstanceIds.size + 1); // Ambush! put one more villain into play
    const entered = inPlayAfter.find((v) => !originalVillainInstanceIds.has(v.instanceId));
    expect(entered).toBeDefined();
    expect(after.activeVillainId).toBe(entered!.instanceId); // "place the active counter on it"
    // Chase!'s own printed 5 starting threat + its Hinder 10[per_hero] (1 player), same as Trap!'s own entry (RRG 1.8
    // "Hinder X", p. 22).
    expect(inst(after, light).threat).toBe(15);
  });
});

describe("27102b.light-at-the-end-forced-interrupt (Chase!)", () => {
  it("when the last threat is removed from Chase!, the players escape and win the game", () => {
    let state = sinisterSixGame([{ starterDeckId: "ghost-spider" }]);
    const light = instancesOf(state, "27102a")[0]!;
    state = patchInstance(state, light, { threat: 1 });
    state = thwart(state, light);
    expect(inst(state, light).cardId).toBe(cardId("27102b"));
    state = patchInstance(state, light, { threat: 1 });
    const won = thwart(state, light);
    expect(won.outcome?.result).toBe("win");
  });
});
