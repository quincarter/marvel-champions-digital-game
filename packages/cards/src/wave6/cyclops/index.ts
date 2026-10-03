import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { CYCLOPS_HERO_ABILITIES } from "./cyclops/index.js";
import { CYCLOPS_PRECON_PLAYER_CARDS } from "./precon-player-cards.js";

/**
 * The Cyclops hero pack's ability scripts (`cyclops`, MC33): one folder per hero (`cyclops/`, identity only so far).
 * The pack has no modular set of its own.
 */
export const CYCLOPS_ABILITIES: AbilityRegistry = mergeRegistries(CYCLOPS_HERO_ABILITIES, CYCLOPS_PRECON_PLAYER_CARDS);

export { CYCLOPS_HERO_ABILITIES } from "./cyclops/index.js";
export { CYCLOPS_PRECON_PLAYER_CARDS } from "./precon-player-cards.js";
