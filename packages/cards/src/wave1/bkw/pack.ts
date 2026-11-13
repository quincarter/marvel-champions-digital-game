import { BKW_CARDS, BKW_ENCOUNTER_SETS, BKW_PACK, BKW_SCENARIOS, BKW_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { BKW_ABILITIES } from "./index.js";

/** The `bkw` product as a built-in pack: its own cards and scripts, not Core's reprints. */
export const BKW_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "bkw", kind: "hero", name: BKW_PACK.name, product: BKW_PACK },
  cards: BKW_CARDS,
  encounterSets: BKW_ENCOUNTER_SETS,
  scenarios: BKW_SCENARIOS,
  decks: BKW_STARTER_DECKS,
  abilities: BKW_ABILITIES,
});
