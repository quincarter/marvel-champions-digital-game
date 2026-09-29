import { createGame, type GameSetupConfig, type GameState, type InstanceId } from "@mc/engine";
import { firstLegal, runWith, settle, type Picker } from "../testing/harness.js";
import {
  defeatWithAttack as defeatWithAttackWith,
  playFromHand as playFromHandWith,
  revealFromEncounterDeck as revealFromEncounterDeckWith,
} from "../testing/staging.js";
import { WAVE5_DEPS } from "./index.js";

/** Test helpers for wave 5 (cycle 4) content — the wave 5 analog of `../wave4/testing.ts`. */

/** `run`, wired to `WAVE5_DEPS`. */
export const runWave5 = (state: GameState, ...commands: Parameters<typeof runWith>[2][]): GameState =>
  runWith(WAVE5_DEPS, state, ...commands);

/** A wave 5 game past setup, with every opening hand kept. */
export function startWave5Game(config: GameSetupConfig): GameState {
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
}

/** `../testing/staging.ts`'s `playFromHand`, wired to `WAVE5_DEPS`. */
export const playFromHand = (
  state: GameState,
  code: string,
  cost: number,
  pick: Picker = firstLegal,
): { readonly state: GameState; readonly id: InstanceId } => playFromHandWith(WAVE5_DEPS, state, code, cost, pick);

/** `../testing/staging.ts`'s `revealFromEncounterDeck`, wired to `WAVE5_DEPS`. */
export const revealFromEncounterDeck = (
  state: GameState,
  code: string,
  pick: Picker = firstLegal,
  fillers = 1,
): { readonly state: GameState; readonly id: InstanceId } =>
  revealFromEncounterDeckWith(WAVE5_DEPS, state, code, pick, fillers);

/** `../testing/staging.ts`'s `defeatWithAttack`, wired to `WAVE5_DEPS`. */
export const defeatWithAttack = (state: GameState, target: InstanceId): GameState =>
  defeatWithAttackWith(WAVE5_DEPS, state, target);

export { WAVE5_DEPS } from "./index.js";
export { answer, runWith, settle, settleUntil } from "../testing/harness.js";
export { encounterCardInVillainArea } from "../testing/staging.js";
