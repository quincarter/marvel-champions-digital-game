/**
 * Wave 6 (PLAN.md Phase 7 / docs/phase7-wave6.md): cycle 6, Mutant Genesis (`mut_gen`), the six X-Men hero packs and
 * MojoMania (`mojo`).
 *
 * **Adding a pack is one line here, plus that pack's own files under `wave6/<pack>/<hero>/`** — mirrors
 * `../wave5/index.ts`. No pack is scripted yet: the registry is wave 5's, unchanged.
 */
import type { AbilityRegistry, EngineDeps } from "@mc/engine";
import { mergeRegistries } from "../dsl/index.js";
import { WAVE5_ABILITIES } from "../wave5/index.js";

/** Every scripted ability in the wave 6 pool: every earlier wave's script, then one entry per wave 6 pack started. */
export const WAVE6_ABILITIES: AbilityRegistry = mergeRegistries(WAVE5_ABILITIES);

/** Engine dependencies for games that use the wave 6 (cycle 6) pool. */
export const WAVE6_DEPS: EngineDeps = { abilities: WAVE6_ABILITIES };

export { wave6Scenario, wave6StarterDeckSetup } from "./setup.js";
export type { Wave6ScenarioOptions } from "./setup.js";
export { WAVE6_CARDS } from "./cards.js";
