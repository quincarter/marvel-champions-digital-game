import {
  CYCLOPS_CARDS,
  CYCLOPS_ENCOUNTER_SETS,
  CYCLOPS_PACK,
  CYCLOPS_SCENARIOS,
  CYCLOPS_STARTER_DECKS,
} from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { CYCLOPS_HERO_ABILITIES } from "./cyclops/index.js";
import { CYCLOPS_PRECON_PLAYER_CARDS } from "./precon-player-cards.js";

/**
 * The `cyclops` product (MC33) as a built-in pack: its cards and every script they need. One folder per hero
 * (`cyclops/`, identity only so far) plus the precon's player cards; the pack has no modular set of its own.
 */
export const CYCLOPS_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "cyclops", kind: "hero", name: CYCLOPS_PACK.name, product: CYCLOPS_PACK },
  cards: CYCLOPS_CARDS,
  encounterSets: CYCLOPS_ENCOUNTER_SETS,
  scenarios: CYCLOPS_SCENARIOS,
  decks: CYCLOPS_STARTER_DECKS,
  abilities: mergeRegistries(CYCLOPS_HERO_ABILITIES, CYCLOPS_PRECON_PLAYER_CARDS),
});
