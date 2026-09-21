import { createGame, type GameSetupConfig, type GameState, type InstanceId } from "@mc/engine";
import { firstLegal, runWith, settle, type Picker } from "../testing/harness.js";
import {
  defeatWithAttack as defeatWithAttackWith,
  playFromHand as playFromHandWith,
  revealFromEncounterDeck as revealFromEncounterDeckWith,
} from "../testing/staging.js";
import { WAVE2_DEPS } from "./index.js";

/**
 * Test helpers for wave 2 (cycle 1) content, over the same `@mc/engine` surface `../testing/harness.ts` uses for
 * Core and `../wave1/testing.ts` uses for wave 1. SHARED FILE: every pack agent imports this (and
 * `../testing/harness.js`'s deps-agnostic helpers, and `../testing/staging.js`'s scenario-reach helpers — most of
 * which are deps-agnostic too and can be imported straight from there; `playFromHand`, `revealFromEncounterDeck`
 * and `defeatWithAttack` below are the `WAVE2_DEPS`-bound wrappers of `../testing/staging.js`'s deps-parameterized
 * versions, kept here so a pack's tests read exactly as they did before that file existed), never edits it. See
 * docs/phase7-wave2-scripting.md.
 */

/** `run`, wired to `WAVE2_DEPS` — the wave 2 analog of `../wave1/testing.ts`'s `runWave1`. */
export const runWave2 = (state: GameState, ...commands: Parameters<typeof runWith>[2][]): GameState =>
  runWith(WAVE2_DEPS, state, ...commands);

/** A wave 2 game past setup, with every opening hand kept — the wave 2 analog of `startWave1Game`. */
export function startWave2Game(config: GameSetupConfig): GameState {
  const created = createGame(config, WAVE2_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE2_DEPS);
}

/** `../testing/staging.ts`'s `playFromHand`, wired to `WAVE2_DEPS`. */
export const playFromHand = (
  state: GameState,
  code: string,
  cost: number,
  pick: Picker = firstLegal,
): { readonly state: GameState; readonly id: InstanceId } => playFromHandWith(WAVE2_DEPS, state, code, cost, pick);

/** `../testing/staging.ts`'s `revealFromEncounterDeck`, wired to `WAVE2_DEPS`. */
export const revealFromEncounterDeck = (
  state: GameState,
  code: string,
  pick: Picker = firstLegal,
  fillers = 1,
): { readonly state: GameState; readonly id: InstanceId } =>
  revealFromEncounterDeckWith(WAVE2_DEPS, state, code, pick, fillers);

/** `../testing/staging.ts`'s `defeatWithAttack`, wired to `WAVE2_DEPS`. */
export const defeatWithAttack = (state: GameState, target: InstanceId): GameState =>
  defeatWithAttackWith(WAVE2_DEPS, state, target);

export { WAVE2_DEPS } from "./index.js";
export { answer, runWith, settle, settleUntil } from "../testing/harness.js";
