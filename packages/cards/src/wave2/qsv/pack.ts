import { QSV_CARDS, QSV_ENCOUNTER_SETS, QSV_PACK, QSV_SCENARIOS, QSV_STARTER_DECKS } from "@mc/content";
import { abilitiesForCards, defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WAVE2_REPRINT_ABILITIES } from "../reprints.js";
import { QSV_ABILITIES } from "./index.js";

/** The `qsv` product as a built-in pack: its cards and every script they need, reprint aliases included. */
export const QSV_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "qsv", kind: "hero", name: QSV_PACK.name, product: QSV_PACK },
  cards: QSV_CARDS,
  encounterSets: QSV_ENCOUNTER_SETS,
  scenarios: QSV_SCENARIOS,
  decks: QSV_STARTER_DECKS,
  abilities: mergeRegistries(abilitiesForCards(WAVE2_REPRINT_ABILITIES, QSV_CARDS), QSV_ABILITIES),
});
