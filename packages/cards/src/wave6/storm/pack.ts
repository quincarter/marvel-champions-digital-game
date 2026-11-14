import { STORM_CARDS, STORM_ENCOUNTER_SETS, STORM_PACK, STORM_SCENARIOS, STORM_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { SHADOW_KING_ABILITIES } from "./shadow-king/index.js";
import { STORM_HERO_ABILITIES } from "./storm/index.js";

/**
 * The `storm` product (MC36) as a built-in pack: its cards and every script they need. One folder per hero (`storm/`,
 * identity and WEATHER supports so far) and the Shadow King modular set (`shadow-king/`).
 */
export const STORM_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "storm", kind: "hero", name: STORM_PACK.name, product: STORM_PACK },
  cards: STORM_CARDS,
  encounterSets: STORM_ENCOUNTER_SETS,
  scenarios: STORM_SCENARIOS,
  decks: STORM_STARTER_DECKS,
  abilities: mergeRegistries(STORM_HERO_ABILITIES, SHADOW_KING_ABILITIES),
});
