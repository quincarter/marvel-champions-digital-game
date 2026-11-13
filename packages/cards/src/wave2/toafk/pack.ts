import { TOAFK_CARDS, TOAFK_ENCOUNTER_SETS, TOAFK_PACK, TOAFK_SCENARIOS, TOAFK_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE2_REPRINT_ABILITIES } from "../reprints.js";
import { TOAFK_ABILITIES } from "./index.js";

/** The `toafk` product as a built-in pack: its cards and every script they need, reprint aliases included. */
export const TOAFK_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "toafk", kind: "scenario", name: TOAFK_PACK.name, product: TOAFK_PACK },
  cards: TOAFK_CARDS,
  encounterSets: TOAFK_ENCOUNTER_SETS,
  scenarios: TOAFK_SCENARIOS,
  decks: TOAFK_STARTER_DECKS,
  abilities: mergeRegistries(abilitiesForCards(WAVE2_REPRINT_ABILITIES, TOAFK_CARDS), TOAFK_ABILITIES),
});
