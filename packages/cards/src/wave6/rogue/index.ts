import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { REAVERS_ABILITIES } from "./reavers/index.js";
import { ROGUE_HERO_ABILITIES } from "./rogue/index.js";

/**
 * The Rogue hero pack's ability scripts (`rogue`, MC38). Her own hero folder (`rogue/rogue/`: identity and Touched so far) and
 * the Reavers modular set (38029-38035).
 */
export const ROGUE_ABILITIES: AbilityRegistry = mergeRegistries(ROGUE_HERO_ABILITIES, REAVERS_ABILITIES);

export { REAVERS_ABILITIES } from "./reavers/index.js";
export { ROGUE_HERO_ABILITIES } from "./rogue/index.js";
