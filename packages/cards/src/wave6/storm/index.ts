import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { SHADOW_KING_ABILITIES } from "./shadow-king/index.js";
import { STORM_HERO_ABILITIES } from "./storm/index.js";

/**
 * The Storm hero pack's ability scripts (`storm`, MC36): one folder per hero (`storm/`, identity and WEATHER supports
 * so far). The Shadow King modular set is `shadow-king/`.
 */
export const STORM_ABILITIES: AbilityRegistry = mergeRegistries(STORM_HERO_ABILITIES, SHADOW_KING_ABILITIES);

export { STORM_HERO_ABILITIES } from "./storm/index.js";
export { SHADOW_KING_ABILITIES } from "./shadow-king/index.js";
