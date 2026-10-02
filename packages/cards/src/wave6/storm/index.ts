import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { STORM_HERO_ABILITIES } from "./storm/index.js";

/**
 * The Storm hero pack's ability scripts (`storm`, MC36): one folder per hero (`storm/`, identity and WEATHER supports
 * so far). The pack's Shadow King modular set is not started.
 */
export const STORM_ABILITIES: AbilityRegistry = mergeRegistries(STORM_HERO_ABILITIES);

export { STORM_HERO_ABILITIES } from "./storm/index.js";
