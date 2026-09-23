import { createGame, type GameSetupConfig, type GameState, type InstanceId } from "@mc/engine";
import { firstLegal, runWith, settle, type Picker } from "../testing/harness.js";
import {
  defeatWithAttack as defeatWithAttackWith,
  playFromHand as playFromHandWith,
  revealFromEncounterDeck as revealFromEncounterDeckWith,
} from "../testing/staging.js";
import { WAVE3_DEPS } from "./index.js";

/**
 * Test helpers for wave 3 (cycle 2) content — the wave 3 analog of `../wave2/testing.ts`. See
 * docs/phase7-wave3-scripting.md.
 */

/** `run`, wired to `WAVE3_DEPS`. */
export const runWave3 = (state: GameState, ...commands: Parameters<typeof runWith>[2][]): GameState =>
  runWith(WAVE3_DEPS, state, ...commands);

/** A wave 3 game past setup, with every opening hand kept. */
export function startWave3Game(config: GameSetupConfig): GameState {
  const created = createGame(config, WAVE3_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE3_DEPS);
}

/** `../testing/staging.ts`'s `playFromHand`, wired to `WAVE3_DEPS`. */
export const playFromHand = (
  state: GameState,
  code: string,
  cost: number,
  pick: Picker = firstLegal,
): { readonly state: GameState; readonly id: InstanceId } => playFromHandWith(WAVE3_DEPS, state, code, cost, pick);

/** `../testing/staging.ts`'s `revealFromEncounterDeck`, wired to `WAVE3_DEPS`. */
export const revealFromEncounterDeck = (
  state: GameState,
  code: string,
  pick: Picker = firstLegal,
  fillers = 1,
): { readonly state: GameState; readonly id: InstanceId } =>
  revealFromEncounterDeckWith(WAVE3_DEPS, state, code, pick, fillers);

/** `../testing/staging.ts`'s `defeatWithAttack`, wired to `WAVE3_DEPS`. */
export const defeatWithAttack = (state: GameState, target: InstanceId): GameState =>
  defeatWithAttackWith(WAVE3_DEPS, state, target);

export { WAVE3_DEPS } from "./index.js";
export { answer, runWith, settle, settleUntil } from "../testing/harness.js";
export { encounterCardInVillainArea } from "../testing/staging.js";
