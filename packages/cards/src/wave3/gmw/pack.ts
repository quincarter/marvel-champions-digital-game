import { GMW_CARDS, GMW_ENCOUNTER_SETS, GMW_PACK, GMW_SCENARIOS, GMW_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE3_REPRINT_ABILITIES } from "../reprints.js";
import { GMW_ABILITIES } from "./index.js";

/** The `gmw` product as a built-in pack: its cards and every script they need, reprint aliases included. */
export const GMW_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "gmw", kind: "campaign", name: GMW_PACK.name, product: GMW_PACK },
  cards: GMW_CARDS,
  encounterSets: GMW_ENCOUNTER_SETS,
  scenarios: GMW_SCENARIOS,
  decks: GMW_STARTER_DECKS,
  abilities: mergeRegistries(abilitiesForCards(WAVE3_REPRINT_ABILITIES, GMW_CARDS), GMW_ABILITIES),
});
