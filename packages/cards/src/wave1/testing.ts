import { createGame, type Command, type GameEvent, type GameSetupConfig, type GameState } from "@mc/engine";
import { firstLegal, runWith, settle } from "../testing/harness.js";
import { driveEvents as driveEventsWith } from "../testing/staging.js";
import { WAVE1_DEPS } from "./index.js";

/**
 * Test helpers for wave 1 content, over the same `@mc/engine` surface `../testing/harness.ts` uses for Core.
 * SHARED FILE: every pack agent imports this (and `../testing/harness.js`'s deps-agnostic helpers — `play`,
 * `use`, `identityOf`, `inst`, `playerOf`, `moveToHand`, `putOnTopOfDeck`, `patchInstance`, `resourceAbility`,
 * `stackEncounterDeck`, `payWith`, `picking`, `firstLegal`, all unaffected by which content is loaded — plus
 * `../testing/staging.js`'s scenario-reach helpers, most of which are deps-agnostic too and can be imported
 * straight from there; `driveEvents` below is the `WAVE1_DEPS`-bound wrapper of `../testing/staging.js`'s
 * deps-parameterized version, kept here so a pack's tests read exactly as they did before that file existed),
 * never edits it. See docs/phase7-wave1-scripting.md "Test conventions".
 */

/** `run`, wired to `WAVE1_DEPS` — the wave 1 analog of `../testing/harness.ts`'s `run` (which is pinned to Core). */
export const runWave1 = (state: GameState, ...commands: Parameters<typeof runWith>[2][]): GameState => runWith(WAVE1_DEPS, state, ...commands);

/** A wave 1 game past setup, with every opening hand kept — the wave 1 analog of `startCoreGame`. */
export function startWave1Game(config: GameSetupConfig): GameState {
  const created = createGame(config, WAVE1_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE1_DEPS);
}

/** `../testing/staging.ts`'s `driveEvents`, wired to `WAVE1_DEPS`. */
export const driveEvents = (state: GameState, ...commands: readonly Command[]): { readonly state: GameState; readonly events: readonly GameEvent[] } =>
  driveEventsWith(WAVE1_DEPS, state, ...commands);

export { WAVE1_DEPS } from "./index.js";
export { answer, runWith, settle, settleUntil } from "../testing/harness.js";
