import { TRORS_CARDS, TRORS_ENCOUNTER_SETS, TRORS_PACK, TRORS_SCENARIOS, TRORS_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE2_REPRINT_ABILITIES } from "../reprints.js";
import { TRORS_ABILITIES } from "./index.js";

/** The `trors` product as a built-in pack: its cards and every script they need, reprint aliases included. */
export const TRORS_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "trors", kind: "campaign", name: TRORS_PACK.name, product: TRORS_PACK },
  cards: TRORS_CARDS,
  encounterSets: TRORS_ENCOUNTER_SETS,
  scenarios: TRORS_SCENARIOS,
  decks: TRORS_STARTER_DECKS,
  abilities: mergeRegistries(abilitiesForCards(WAVE2_REPRINT_ABILITIES, TRORS_CARDS), TRORS_ABILITIES),
});
