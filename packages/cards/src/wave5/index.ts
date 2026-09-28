/**
 * Wave 5 (PLAN.md Phase 7 / docs/phase7-wave5.md): cycle 4, starting with the Sinister Motives (`sm`) box, joined
 * by the Nova hero pack (`nova`).
 *
 * **Adding a pack is one line here, plus that pack's own new files under `wave5/<pack>/`** — mirrors
 * `../wave4/index.ts` exactly.
 */
import type { AbilityRegistry, EngineDeps } from "@mc/engine";
import { mergeRegistries } from "../dsl/index.js";
import { WAVE4_ABILITIES } from "../wave4/index.js";
import { NOVA_ABILITIES } from "./nova/index.js";
import { SM_ABILITIES } from "./sm/index.js";

/** Every scripted ability in the wave 5 pool: every earlier wave's own script, then one entry per cycle 4 pack
 * that has been started (`sm`, `nova`; `ironheart`, `spiderham`, `spdr` join here once scripted). */
export const WAVE5_ABILITIES: AbilityRegistry = mergeRegistries(WAVE4_ABILITIES, SM_ABILITIES, NOVA_ABILITIES);

/** Engine dependencies for games that use the wave 5 (cycle 4) pool. */
export const WAVE5_DEPS: EngineDeps = { abilities: WAVE5_ABILITIES };

export { wave5Scenario, wave5StarterDeckSetup } from "./setup.js";
export type { Wave5ScenarioOptions } from "./setup.js";
export { WAVE5_CARDS } from "./cards.js";
