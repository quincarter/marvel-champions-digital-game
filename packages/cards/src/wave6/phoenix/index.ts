import type { AbilityRegistry } from "@mc/engine";
import { PHOENIX_HERO_ABILITIES } from "./phoenix/index.js";

/**
 * The Phoenix hero pack's ability scripts (`phoenix`, MC34): one folder per hero (`phoenix/`, identity and Phoenix
 * Force only so far). The pack has no modular set of its own.
 */
export const PHOENIX_ABILITIES: AbilityRegistry = PHOENIX_HERO_ABILITIES;

export { PHOENIX_HERO_ABILITIES } from "./phoenix/index.js";
