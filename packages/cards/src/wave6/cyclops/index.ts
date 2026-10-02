import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { CYCLOPS_HERO_ABILITIES } from "./cyclops/index.js";

/**
 * The Cyclops hero pack's ability scripts (`cyclops`, MC33): one folder per hero (`cyclops/`, identity only so far).
 * The pack has no modular set of its own.
 */
export const CYCLOPS_ABILITIES: AbilityRegistry = mergeRegistries(CYCLOPS_HERO_ABILITIES);

export { CYCLOPS_HERO_ABILITIES } from "./cyclops/index.js";
