import { WSP_CARDS, WSP_ENCOUNTER_SETS, WSP_PACK, WSP_SCENARIOS, WSP_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE2_REPRINT_ABILITIES } from "../reprints.js";
import { WSP_ABILITIES } from "./index.js";

/** The `wsp` product as a built-in pack: its cards and every script they need, reprint aliases included. */
export const WSP_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "wsp", kind: "hero", name: WSP_PACK.name, product: WSP_PACK },
  cards: WSP_CARDS,
  encounterSets: WSP_ENCOUNTER_SETS,
  scenarios: WSP_SCENARIOS,
  decks: WSP_STARTER_DECKS,
  abilities: mergeRegistries(abilitiesForCards(WAVE2_REPRINT_ABILITIES, WSP_CARDS), WSP_ABILITIES),
});
