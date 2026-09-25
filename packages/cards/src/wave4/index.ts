/**
 * Wave 4 (PLAN.md Phase 7 / docs/phase7-wave4.md): cycle 4, starting with the Nebula (`nebu`) hero pack.
 *
 * **Adding a pack is one line here, plus that pack's own new files under `wave4/<pack>/`** — mirrors
 * `../wave3/index.ts` exactly.
 */
import type { AbilityRegistry, EngineDeps } from "@mc/engine";
import { mergeRegistries } from "../dsl/index.js";
import { WAVE3_ABILITIES } from "../wave3/index.js";
import { MTS_ABILITIES } from "./mts/index.js";
import { NEBU_ABILITIES } from "./nebu/index.js";
import { WARM_ABILITIES } from "./warm/index.js";

/** Every scripted ability in the wave 4 pool: every earlier (Core/wave 1/cycle 1/cycle 2/cycle 3) script, then one
 * entry per cycle 4 pack that has been started (`nebu`, `warm`, `mts`). */
export const WAVE4_ABILITIES: AbilityRegistry = mergeRegistries(
  WAVE3_ABILITIES,
  NEBU_ABILITIES,
  WARM_ABILITIES,
  MTS_ABILITIES,
);

/** Engine dependencies for games that use the wave 4 (cycle 4) pool. */
export const WAVE4_DEPS: EngineDeps = { abilities: WAVE4_ABILITIES };

export { wave4Scenario, wave4StarterDeckSetup } from "./setup.js";
export type { Wave4ScenarioOptions } from "./setup.js";
export { WAVE4_CARDS } from "./cards.js";
