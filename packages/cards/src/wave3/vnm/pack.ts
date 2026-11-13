import { VNM_CARDS, VNM_ENCOUNTER_SETS, VNM_PACK, VNM_SCENARIOS, VNM_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE3_REPRINT_ABILITIES } from "../reprints.js";
import { VNM_ABILITIES } from "./index.js";

/** The `vnm` product as a built-in pack: its cards and every script they need, reprint aliases included. */
export const VNM_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "vnm", kind: "hero", name: VNM_PACK.name, product: VNM_PACK },
  cards: VNM_CARDS,
  encounterSets: VNM_ENCOUNTER_SETS,
  scenarios: VNM_SCENARIOS,
  decks: VNM_STARTER_DECKS,
  abilities: mergeRegistries(abilitiesForCards(WAVE3_REPRINT_ABILITIES, VNM_CARDS), VNM_ABILITIES),
});
