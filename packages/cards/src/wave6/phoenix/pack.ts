import {
  PHOENIX_CARDS,
  PHOENIX_ENCOUNTER_SETS,
  PHOENIX_PACK,
  PHOENIX_SCENARIOS,
  PHOENIX_STARTER_DECKS,
} from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { PHOENIX_HERO_ABILITIES } from "./phoenix/index.js";
import { PHOENIX_PRECON_PLAYER_CARDS } from "./precon-player-cards.js";

/**
 * The `phoenix` product (MC34) as a built-in pack: its cards and every script they need. One folder per hero
 * (`phoenix/`, identity and Phoenix Force so far) plus the precon's player cards; the pack has no modular set of its
 * own.
 */
export const PHOENIX_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "phoenix", kind: "hero", name: PHOENIX_PACK.name, product: PHOENIX_PACK },
  cards: PHOENIX_CARDS,
  encounterSets: PHOENIX_ENCOUNTER_SETS,
  scenarios: PHOENIX_SCENARIOS,
  decks: PHOENIX_STARTER_DECKS,
  abilities: mergeRegistries(PHOENIX_HERO_ABILITIES, PHOENIX_PRECON_PLAYER_CARDS),
});
