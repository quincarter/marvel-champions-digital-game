import { GAM_CARDS, GAM_ENCOUNTER_SETS, GAM_PACK, GAM_SCENARIOS, GAM_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE3_REPRINT_ABILITIES } from "../reprints.js";
import { GAM_ABILITIES } from "./index.js";

/** The `gam` product as a built-in pack: its cards and every script they need, reprint aliases included. */
export const GAM_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "gam", kind: "hero", name: GAM_PACK.name, product: GAM_PACK },
  cards: GAM_CARDS,
  encounterSets: GAM_ENCOUNTER_SETS,
  scenarios: GAM_SCENARIOS,
  decks: GAM_STARTER_DECKS,
  abilities: mergeRegistries(abilitiesForCards(WAVE3_REPRINT_ABILITIES, GAM_CARDS), GAM_ABILITIES),
});
