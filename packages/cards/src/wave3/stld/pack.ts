import { STLD_CARDS, STLD_ENCOUNTER_SETS, STLD_PACK, STLD_SCENARIOS, STLD_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE3_REPRINT_ABILITIES } from "../reprints.js";
import { STLD_ABILITIES } from "./index.js";

/** The `stld` product as a built-in pack: its cards and every script they need, reprint aliases included. */
export const STLD_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "stld", kind: "hero", name: STLD_PACK.name, product: STLD_PACK },
  cards: STLD_CARDS,
  encounterSets: STLD_ENCOUNTER_SETS,
  scenarios: STLD_SCENARIOS,
  decks: STLD_STARTER_DECKS,
  abilities: mergeRegistries(abilitiesForCards(WAVE3_REPRINT_ABILITIES, STLD_CARDS), STLD_ABILITIES),
});
