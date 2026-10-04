import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { PHOENIX_HERO_ABILITIES } from "./phoenix/index.js";
import { PHOENIX_PRECON_PLAYER_CARDS } from "./precon-player-cards.js";

/**
 * The Phoenix hero pack's ability scripts (`phoenix`, MC34): one folder per hero (`phoenix/`, identity and Phoenix
 * Force only so far). The pack has no modular set of its own.
 */
export const PHOENIX_ABILITIES: AbilityRegistry = mergeRegistries(PHOENIX_HERO_ABILITIES, PHOENIX_PRECON_PLAYER_CARDS);

export { PHOENIX_HERO_ABILITIES } from "./phoenix/index.js";
export { PHOENIX_PRECON_PLAYER_CARDS } from "./precon-player-cards.js";
