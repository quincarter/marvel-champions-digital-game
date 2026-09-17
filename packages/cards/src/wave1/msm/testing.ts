import { createGame, type EngineDeps, type GameSetupConfig, type GameState } from "@mc/engine";
import { firstLegal, runWith, settle } from "../../testing/harness.js";
import { WAVE1_ABILITIES } from "../index.js";

/**
 * Test deps for the `msm` pack. `MSM_ABILITIES` is now registered in `../index.ts`'s `WAVE1_ABILITIES`, so this is
 * the same registry as `../testing.ts`'s `WAVE1_DEPS`; the names are kept so the pack's tests read unchanged.
 */
export const MSM_DEPS: EngineDeps = { abilities: WAVE1_ABILITIES };

/** `run`, wired to `MSM_DEPS` — the `msm`-local analog of `../testing.ts`'s `runWave1`. */
export const runMsm = (state: GameState, ...commands: Parameters<typeof runWith>[2][]): GameState => runWith(MSM_DEPS, state, ...commands);

/** A wave 1 game past setup, with every opening hand kept, using `MSM_DEPS`. */
export function startMsmGame(config: GameSetupConfig): GameState {
  const created = createGame(config, MSM_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", MSM_DEPS);
}

export { answer, runWith, settle, settleUntil } from "../../testing/harness.js";
