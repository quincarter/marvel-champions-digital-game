/**
 * Wave 7 (PLAN.md Phase 7 / docs/phase7-wave7.md): cycle 7, NeXt Evolution (`next_evol`, Cable and Domino with the
 * five-scenario campaign box) and the four hero packs `psylocke`, `angel`, `x23` and `deadpool`.
 *
 * Every pack is scripted (each pack's registry is merged from per-group modules, one module per scenario and modular
 * set, so parallel scripting agents never share a file) and the wave is joined to `playable/` (`PLAYABLE_ABILITIES`,
 * `playableScenario`, `playableStarterDeckSetup`).
 */
import type { AbilityRegistry, EngineDeps } from "@mc/engine";
import { mergeRegistries } from "../dsl/index.js";
import { WAVE6_ABILITIES } from "../wave6/index.js";
import { ANGEL_ABILITIES } from "./angel/index.js";
import { DEADPOOL_ABILITIES } from "./deadpool/index.js";
import { NEXT_EVOL_ABILITIES } from "./next_evol/index.js";
import { PSYLOCKE_ABILITIES } from "./psylocke/index.js";
import { X23_ABILITIES } from "./x23/index.js";

/** Every scripted ability in the wave 7 pool: every earlier wave's script, then one entry per wave 7 pack started. */
export const WAVE7_ABILITIES: AbilityRegistry = mergeRegistries(
  WAVE6_ABILITIES,
  NEXT_EVOL_ABILITIES,
  PSYLOCKE_ABILITIES,
  ANGEL_ABILITIES,
  X23_ABILITIES,
  DEADPOOL_ABILITIES,
);

/** Engine dependencies for games that use the wave 7 (cycle 7) pool. */
export const WAVE7_DEPS: EngineDeps = { abilities: WAVE7_ABILITIES };

export { wave7Scenario, wave7StarterDeckSetup } from "./setup.js";
export type { Wave7ScenarioOptions } from "./setup.js";
export { WAVE7_CARDS } from "./cards.js";
