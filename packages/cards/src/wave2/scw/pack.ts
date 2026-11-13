import { SCW_CARDS, SCW_ENCOUNTER_SETS, SCW_PACK, SCW_SCENARIOS, SCW_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE2_REPRINT_ABILITIES } from "../reprints.js";
import { SCW_ABILITIES } from "./index.js";

/** The `scw` product as a built-in pack: its cards and every script they need, reprint aliases included. */
export const SCW_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "scw", kind: "hero", name: SCW_PACK.name, product: SCW_PACK },
  cards: SCW_CARDS,
  encounterSets: SCW_ENCOUNTER_SETS,
  scenarios: SCW_SCENARIOS,
  decks: SCW_STARTER_DECKS,
  abilities: mergeRegistries(abilitiesForCards(WAVE2_REPRINT_ABILITIES, SCW_CARDS), SCW_ABILITIES),
});
