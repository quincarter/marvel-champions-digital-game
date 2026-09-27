import { createGame, undefeatedVillains, type GameSetupConfig, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  patchInstance,
  settle,
  stackEncounterDeck,
  toHero,
  P1,
} from "../../../testing/harness.js";
import { defeatWithAttack, runWave5, WAVE5_DEPS } from "../../testing.js";
import { wave5Scenario, type Wave5ScenarioOptions } from "../../setup.js";

/**
 * Real-game tests for `villains.ts`'s `sinisterSixVillain` helper, exercised through Doctor Octopus (27094; MC27
 * p. 15, docs/phase7-wave5.md §1.5/§3.1). Electro, Hobgoblin, Kraven the Hunter, Scorpion and Vulture reuse the same
 * helper (separate, later agents' work) and so are covered by these same assertions once they register their own
 * ability ids.
 *
 * Seed 1 (`sinisterSixGame`'s default) puts exactly Doctor Octopus (27094, activation order 1, lowest — so he always
 * holds the active counter at setup) and Electro (27095, activation order 2) into play for a 1-player game.
 */
function sinisterSixGame(
  players: Wave5ScenarioOptions["players"],
  overrides: Partial<Wave5ScenarioOptions> = {},
): GameState {
  const config: GameSetupConfig = wave5Scenario("sinister-six", { seed: 19, players, ...overrides });
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
}

/** Changes to hero form so the identity can be attacked (and can itself attack, for `defeatWithAttack`). */
function toHeroApplied(state: GameState): GameState {
  return settle(runWave5(state, toHero(P1)), firstLegal, undefined, WAVE5_DEPS);
}

/** Sinister Synchronization 1A's own `acceleration: { base: 0, perPlayer: 1 }`: +1 main scheme threat every villain
 * phase, in 1 player, independent of anything Doctor Octopus does — accounted for so the main-scheme assertions below
 * isolate his own Forced Response's "+1 threat" from this baseline. */
const ACCELERATION_PER_ROUND = 1;
const mainThreatOf = (state: GameState): number => inst(state, state.mainScheme.instanceId).threat;
const lightThreatOf = (state: GameState): number => inst(state, instancesOf(state, "27102a")[0]!).threat;
const doctorOckOf = (state: GameState) => instancesOf(state, "27094")[0]!;
const electroOf = (state: GameState) => instancesOf(state, "27095")[0]!;

/**
 * Ends P1's turn and settles through the villain phase's own enemy activations (Doctor Octopus attacks, since P1 is
 * in hero form), stopping right before "Deal each player 1 encounter card" / "reveal encounter cards" — so a random
 * encounter card reveal (which could itself scheme, attack, or otherwise touch threat) never blurs what Doctor
 * Octopus's own Forced Response did.
 */
function activateVillain(state: GameState): GameState {
  return settle(
    runWave5(state, endTurn(P1)),
    firstLegal,
    (s) => s.step.phase === "villain" && s.step.kind === "dealEncounterCards",
    WAVE5_DEPS,
  );
}

describe("27094.doctor-octopus-forced-response", () => {
  it('places exactly 1 threat on each scheme in play and moves the active counter to the next villain in the activation order (RRG "Activation Order")', () => {
    const state = toHeroApplied(sinisterSixGame([{ starterDeckId: "ghost-spider" }]));
    const doctorOck = doctorOckOf(state);
    const electro = electroOf(state);
    expect(state.activeVillainId).toBe(doctorOck); // Doctor Octopus (order 1) starts with the active counter.
    const mainBefore = mainThreatOf(state);
    const lightBefore = lightThreatOf(state);
    const after = activateVillain(state);
    // Doctor Octopus's own attack (ATK 2, undefended) must have damaged the identity for the Forced Response to
    // have fired at all; if it somehow didn't connect this assertion (and the two below) would trivially pass, so
    // guard against that first.
    expect(inst(after, identityOf(after)).damage).toBeGreaterThan(0);
    expect(mainThreatOf(after)).toBe(mainBefore + ACCELERATION_PER_ROUND + 1);
    expect(lightThreatOf(after)).toBe(lightBefore + 1);
    expect(after.activeVillainId).toBe(electro); // moved to the next (and only other) villain in activation order.
  });

  it("a lone Doctor Octopus keeps the active counter after his own Forced Response (MC27 p. 15/p. 21 FAQ: a lone villain keeps the counter)", () => {
    let state = toHeroApplied(sinisterSixGame([{ starterDeckId: "ghost-spider" }]));
    const doctorOck = doctorOckOf(state);
    const electro = electroOf(state);
    // Electro has no script yet (later agent's work), so this defeat is a plain, unscripted removal from play — it
    // does not return him to `encounterSetAside`, only Doctor Octopus's own When Defeated does that (tested below).
    state = patchInstance(state, identityOf(state, P1), { exhausted: false });
    state = defeatWithAttack(state, electro);
    expect(undefeatedVillains(state).map((v) => v.instanceId)).toEqual([doctorOck]);
    expect(state.activeVillainId).toBe(doctorOck);
    const mainBefore = mainThreatOf(state);
    const lightBefore = lightThreatOf(state);
    const after = activateVillain(state);
    expect(inst(after, identityOf(after)).damage).toBeGreaterThan(0);
    expect(mainThreatOf(after)).toBe(mainBefore + ACCELERATION_PER_ROUND + 1); // the Forced Response still fired…
    expect(lightThreatOf(after)).toBe(lightBefore + 1);
    expect(after.activeVillainId).toBe(doctorOck); // …but with no other villain in play, the counter stays put.
  });

  it('does not fire when the attack is fully prevented (no damage taken): the identity\'s "tough" status absorbs the whole hit', () => {
    let state = toHeroApplied(sinisterSixGame([{ starterDeckId: "ghost-spider" }]));
    const doctorOck = doctorOckOf(state);
    const electro = electroOf(state);
    const identity = identityOf(state);
    state = patchInstance(state, identity, { statuses: { ...inst(state, identity).statuses, tough: 1 } });
    const mainBefore = mainThreatOf(state);
    const lightBefore = lightThreatOf(state);
    const after = activateVillain(state);
    expect(inst(after, identity).damage).toBe(0); // toughness absorbed the entire attack: no damage was taken.
    expect(mainThreatOf(after)).toBe(mainBefore + ACCELERATION_PER_ROUND); // acceleration still runs; only
    expect(lightThreatOf(after)).toBe(lightBefore); // fired: no threat placed…
    expect(after.activeVillainId).toBe(doctorOck); // …and the active counter did not move either.
    expect(undefeatedVillains(after).map((v) => v.instanceId)).toContain(electro);
  });
});

describe("27094.when-defeated", () => {
  it("removes 4 threat from a side scheme when another villain is still in play", () => {
    let state = toHeroApplied(sinisterSixGame([{ starterDeckId: "ghost-spider" }]));
    const doctorOck = doctorOckOf(state);
    const lightBefore = lightThreatOf(state);
    state = patchInstance(state, identityOf(state, P1), { exhausted: false });
    const after = defeatWithAttack(state, doctorOck);
    expect(undefeatedVillains(after).map((v) => v.cardId)).toEqual(["27095"]); // Electro is still in play.
    expect(lightThreatOf(after)).toBe(lightBefore - 4);
  });

  it("removes 7 threat instead when no other villain is in play", () => {
    let state = toHeroApplied(sinisterSixGame([{ starterDeckId: "ghost-spider" }]));
    const doctorOck = doctorOckOf(state);
    const electro = electroOf(state);
    state = patchInstance(state, identityOf(state, P1), { exhausted: false });
    state = defeatWithAttack(state, electro); // unscripted removal, leaving Doctor Octopus alone.
    const lightBefore = lightThreatOf(state);
    state = patchInstance(state, identityOf(state, P1), { exhausted: false });
    const after = defeatWithAttack(state, doctorOck);
    expect(undefeatedVillains(after)).toHaveLength(0);
    expect(lightThreatOf(after)).toBe(lightBefore - 7);
  });

  it('sets Doctor Octopus aside (RRG 1.8 "Leaves Play", p. 27), so "Ambush!" can later draw him back into play', () => {
    let state = toHeroApplied(sinisterSixGame([{ starterDeckId: "ghost-spider" }]));
    const doctorOck = doctorOckOf(state);
    const electro = electroOf(state);
    state = patchInstance(state, identityOf(state, P1), { exhausted: false });
    state = defeatWithAttack(state, electro);
    state = patchInstance(state, identityOf(state, P1), { exhausted: false });
    state = defeatWithAttack(state, doctorOck);
    expect(undefeatedVillains(state)).toHaveLength(0);
    expect(state.encounterSetAside).toContain(doctorOck); // back in the pool Sinister Synchronization's "Ambush!"
    // (main-scheme.ts) draws a random set-aside villain from.

    // With no villain in play, ending the turn resolves "Ambush!" (main-scheme.ts's own Forced Interrupt) before
    // continuing the villain's activation; seed 5's random draw happens to pick Doctor Octopus back out of the pool.
    state = { ...state, rng: { value: 5, draws: 0 } };
    state = stackEncounterDeck(state, "01186");
    const after = settle(runWave5(state, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    // Ambush! brings him back; a treachery dealt later in the same phase may add another villain, so check membership.
    expect(undefeatedVillains(after).map((v) => v.instanceId)).toContain(doctorOck);
    expect(after.activeVillainId).toBe(doctorOck); // "…and place the active counter on it."
  });
});
