import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { LADY_DEATHSTRIKE_ABILITIES } from "./lady-deathstrike.js";
import { WOLV_PRECON_PLAYER_CARDS } from "./precon-player-cards.js";
import { WOLVERINE_HERO_ABILITIES } from "./wolverine/index.js";

/**
 * The Wolverine hero pack's ability scripts (`wolv`, MC35): one folder per hero (`wolverine/`, identity only so far).
 * The pack's encounter content: the Wolverine nemesis set lives under `wolverine/`, the Lady Deathstrike modular set
 * in `lady-deathstrike.ts`.
 */
export const WOLV_ABILITIES: AbilityRegistry = mergeRegistries(
  WOLVERINE_HERO_ABILITIES,
  WOLV_PRECON_PLAYER_CARDS,
  LADY_DEATHSTRIKE_ABILITIES,
);

export { WOLVERINE_HERO_ABILITIES } from "./wolverine/index.js";
export { LADY_DEATHSTRIKE_ABILITIES } from "./lady-deathstrike.js";
export { WOLV_PRECON_PLAYER_CARDS } from "./precon-player-cards.js";
