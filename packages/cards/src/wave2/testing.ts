import { createGame, type GameSetupConfig, type GameState } from "@mc/engine";
import { firstLegal, runWith, settle } from "../testing/harness.js";
import { WAVE2_DEPS } from "./index.js";

/**
 * Test helpers for wave 2 (cycle 1) content, over the same `@mc/engine` surface `../testing/harness.ts` uses for
 * Core and `../wave1/testing.ts` uses for wave 1. SHARED FILE: every pack agent imports this (and
 * `../testing/harness.js`'s deps-agnostic helpers), never edits it. See docs/phase7-wave2-scripting.md.
 */

/** `run`, wired to `WAVE2_DEPS` — the wave 2 analog of `../wave1/testing.ts`'s `runWave1`. */
export const runWave2 = (state: GameState, ...commands: Parameters<typeof runWith>[2][]): GameState => runWith(WAVE2_DEPS, state, ...commands);

/** A wave 2 game past setup, with every opening hand kept — the wave 2 analog of `startWave1Game`. */
export function startWave2Game(config: GameSetupConfig): GameState {
  const created = createGame(config, WAVE2_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE2_DEPS);
}

export { WAVE2_DEPS } from "./index.js";
export { answer, runWith, settle, settleUntil } from "../testing/harness.js";
