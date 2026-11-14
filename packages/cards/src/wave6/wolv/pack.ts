import { WOLV_CARDS, WOLV_ENCOUNTER_SETS, WOLV_PACK, WOLV_SCENARIOS, WOLV_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { LADY_DEATHSTRIKE_ABILITIES } from "./lady-deathstrike.js";
import { WOLV_PRECON_PLAYER_CARDS } from "./precon-player-cards.js";
import { WOLVERINE_HERO_ABILITIES } from "./wolverine/index.js";

/**
 * The `wolv` product (MC35) as a built-in pack: its cards and every script they need. One folder per hero
 * (`wolverine/`, identity only so far; the Wolverine nemesis set lives there too), the precon's player cards, and the
 * Lady Deathstrike modular set (`lady-deathstrike.ts`).
 */
export const WOLV_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "wolv", kind: "hero", name: WOLV_PACK.name, product: WOLV_PACK },
  cards: WOLV_CARDS,
  encounterSets: WOLV_ENCOUNTER_SETS,
  scenarios: WOLV_SCENARIOS,
  decks: WOLV_STARTER_DECKS,
  abilities: mergeRegistries(WOLVERINE_HERO_ABILITIES, WOLV_PRECON_PLAYER_CARDS, LADY_DEATHSTRIKE_ABILITIES),
});
