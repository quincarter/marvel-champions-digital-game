import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { EXODUS_ABILITIES } from "./exodus/index.js";
import { GAMBIT_HERO_ABILITIES } from "./gambit/index.js";

/**
 * The Gambit hero pack's ability scripts (`gambit`, MC37): one folder per hero (`gambit/`, identity only so far). The
 * pack's modular set (Exodus, 37032-37035) is not started.
 */
export const GAMBIT_ABILITIES: AbilityRegistry = mergeRegistries(GAMBIT_HERO_ABILITIES, EXODUS_ABILITIES);

export { GAMBIT_HERO_ABILITIES } from "./gambit/index.js";
export { EXODUS_ABILITIES } from "./exodus/index.js";
