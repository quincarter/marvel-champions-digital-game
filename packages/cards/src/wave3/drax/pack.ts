import { DRAX_CARDS, DRAX_ENCOUNTER_SETS, DRAX_PACK, DRAX_SCENARIOS, DRAX_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE3_REPRINT_ABILITIES } from "../reprints.js";
import { DRAX_ABILITIES } from "./index.js";

/** The `drax` product as a built-in pack: its cards and every script they need, reprint aliases included. */
export const DRAX_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "drax", kind: "hero", name: DRAX_PACK.name, product: DRAX_PACK },
  cards: DRAX_CARDS,
  encounterSets: DRAX_ENCOUNTER_SETS,
  scenarios: DRAX_SCENARIOS,
  decks: DRAX_STARTER_DECKS,
  abilities: mergeRegistries(abilitiesForCards(WAVE3_REPRINT_ABILITIES, DRAX_CARDS), DRAX_ABILITIES),
});
