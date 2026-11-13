import { RON_CARDS, RON_ENCOUNTER_SETS, RON_PACK, RON_SCENARIOS, RON_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE3_REPRINT_ABILITIES } from "../reprints.js";
import { RON_ABILITIES } from "./index.js";

/** The `ron` product as a built-in pack: its cards and every script they need, reprint aliases included. */
export const RON_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "ron", kind: "modular", name: RON_PACK.name, product: RON_PACK },
  cards: RON_CARDS,
  encounterSets: RON_ENCOUNTER_SETS,
  scenarios: RON_SCENARIOS,
  decks: RON_STARTER_DECKS,
  abilities: mergeRegistries(abilitiesForCards(WAVE3_REPRINT_ABILITIES, RON_CARDS), RON_ABILITIES),
});
