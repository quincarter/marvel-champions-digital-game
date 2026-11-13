import { ANT_CARDS, ANT_ENCOUNTER_SETS, ANT_PACK, ANT_SCENARIOS, ANT_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE2_REPRINT_ABILITIES } from "../reprints.js";
import { ANT_ABILITIES } from "./index.js";

/** The `ant` product as a built-in pack: its cards and every script they need, reprint aliases included. */
export const ANT_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "ant", kind: "hero", name: ANT_PACK.name, product: ANT_PACK },
  cards: ANT_CARDS,
  encounterSets: ANT_ENCOUNTER_SETS,
  scenarios: ANT_SCENARIOS,
  decks: ANT_STARTER_DECKS,
  abilities: mergeRegistries(abilitiesForCards(WAVE2_REPRINT_ABILITIES, ANT_CARDS), ANT_ABILITIES),
});
