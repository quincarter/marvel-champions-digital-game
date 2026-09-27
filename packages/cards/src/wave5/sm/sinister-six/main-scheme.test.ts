import { createGame, undefeatedVillains, type GameSetupConfig, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  patchInstance,
  settle,
  stackEncounterDeck,
  toHero,
} from "../../../testing/harness.js";
import { defeatWithAttack, runWave5, WAVE5_DEPS } from "../../testing.js";
import { wave5Scenario, type Wave5ScenarioOptions } from "../../setup.js";

/**
 * Sinister Synchronization / Sinister Beatdown's own "Ambush!" Special and Forced Interrupt (`sm` 27100a/27100b,
 * 27101a/27101b; MC27 p. 15, docs/phase7-wave5.md §1.5/§3.1/§3.2): "Forced Interrupt: When a villain would activate,
 * if no villain is in play, resolve this card's 'Ambush!' ability. Continue that activation." The six villains'
 * own scripts (their Forced Response / When Defeated abilities) are separate, later work, so these tests reach "no
 * villain in play" by defeating every villain currently in play with a plain basic attack rather than through the
 * villains' own (unscripted) "Set this villain aside" text — which also means a villain defeated this way does not
 * return to the set-aside pool, only the 4 villains the 1A Setup never chose in the first place can.
 */

function sinisterSixGame(
  players: Wave5ScenarioOptions["players"],
  overrides: Partial<Wave5ScenarioOptions> = {},
): GameState {
  const config: GameSetupConfig = wave5Scenario("sinister-six", { seed: 1, players, ...overrides });
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
}

describe("27100b.ambush / 27100b.sinister-synchronization-forced-interrupt", () => {
  it('defeating every villain in play does not win the game (MultipleVillains.winCondition: "cardAbility")', () => {
    let state = sinisterSixGame([{ starterDeckId: "ghost-spider" }]);
    state = toHeroApplied(state);
    state = defeatAllVillains(state);
    expect(undefeatedVillains(state)).toHaveLength(0);
    // The active counter is left on the now-defeated villain (docs/phase7-wave5.md §3.1: "makes 'the villain'
    // nobody" rather than clearing the field), so "the villain" resolves to nobody, not that no game ends the game.
    expect(state.villains.find((v) => v.instanceId === state.activeVillainId)?.defeated).toBe(true);
    expect(state.outcome).toBeNull();
  });

  it("standard: with no villain in play, a villain activation resolves Ambush! — a random set-aside villain enters and takes the active counter", () => {
    let state = sinisterSixGame([{ starterDeckId: "ghost-spider" }]);
    state = toHeroApplied(state);
    const startingVillainIds = new Set(undefeatedVillains(state).map((v) => v.cardId));
    state = defeatAllVillains(state);
    state = stackEncounterDeck(state, "01186");
    const after = settle(runWave5(state, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    const inPlay = undefeatedVillains(after);
    expect(inPlay).toHaveLength(1); // exactly one villain re-entered via "Ambush!"
    const entered = inPlay[0]!;
    expect(after.activeVillainId).toBe(entered.instanceId); // "place the active counter on it"
    expect(startingVillainIds.has(entered.cardId)).toBe(false); // not one of the two already defeated
  });

  it("expert: the same Ambush! also places 2 threat on Light at the End (the parenthetical is unconditional on the mode)", () => {
    let state = sinisterSixGame([{ starterDeckId: "ghost-spider" }], { difficulty: "expert" });
    state = toHeroApplied(state);
    state = defeatAllVillains(state);
    const light = instancesOf(state, "27102a")[0]!;
    const threatBefore = inst(state, light).threat;
    state = stackEncounterDeck(state, "01186");
    const after = settle(runWave5(state, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    expect(undefeatedVillains(after)).toHaveLength(1); // Ambush! still put a villain into play
    expect(inst(after, light).threat).toBe(threatBefore + 2);
  });

  it("standard: the same Ambush! places no threat on Light at the End", () => {
    let state = sinisterSixGame([{ starterDeckId: "ghost-spider" }]);
    state = toHeroApplied(state);
    state = defeatAllVillains(state);
    const light = instancesOf(state, "27102a")[0]!;
    const threatBefore = inst(state, light).threat;
    state = stackEncounterDeck(state, "01186");
    const after = settle(runWave5(state, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    expect(inst(after, light).threat).toBe(threatBefore);
  });
});

/** Changes to hero form so the identity can make a basic attack (`defeatWithAttack`). */
function toHeroApplied(state: GameState): GameState {
  return settle(runWave5(state, toHero(P1)), firstLegal, undefined, WAVE5_DEPS);
}

/**
 * Defeats every currently in-play villain with `defeatWithAttack`, readying the identity between attacks (test-only
 * surgery — a real game would spend several turns and player characters on this, which is not what's under test
 * here: only that the interrupt fires once no villain is left).
 */
function defeatAllVillains(state: GameState): GameState {
  let current = state;
  for (const villain of undefeatedVillains(current)) {
    current = patchInstance(current, identityOf(current, P1), { exhausted: false });
    current = defeatWithAttack(current, villain.instanceId);
  }
  return current;
}
