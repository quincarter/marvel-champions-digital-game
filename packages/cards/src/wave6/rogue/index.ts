import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { REAVERS_ABILITIES } from "./reavers/index.js";

/**
 * The Rogue hero pack's ability scripts (`rogue`, MC38). So far only its Reavers modular set (38029-38035); Rogue's own
 * hero folder (`rogue/rogue/`) comes later, once her engine rows land.
 */
export const ROGUE_ABILITIES: AbilityRegistry = mergeRegistries(REAVERS_ABILITIES);

export { REAVERS_ABILITIES } from "./reavers/index.js";
