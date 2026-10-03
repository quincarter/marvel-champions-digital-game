import type { AbilityRegistry } from "@mc/engine";
import { GAMBIT_HERO_ABILITIES } from "./gambit/index.js";

/**
 * The Gambit hero pack's ability scripts (`gambit`, MC37): one folder per hero (`gambit/`, identity only so far). The
 * pack's modular set (Exodus, 37032-37035) is not started.
 */
export const GAMBIT_ABILITIES: AbilityRegistry = GAMBIT_HERO_ABILITIES;

export { GAMBIT_HERO_ABILITIES } from "./gambit/index.js";
