import { GOB_CARDS, GOB_ENCOUNTER_SETS, GOB_PACK, GOB_SCENARIOS, GOB_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { GOB_ABILITIES } from "./index.js";

/** The `gob` product as a built-in pack: its own cards and scripts, not Core's reprints. */
export const GOB_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "gob", kind: "scenario", name: GOB_PACK.name, product: GOB_PACK },
  cards: GOB_CARDS,
  encounterSets: GOB_ENCOUNTER_SETS,
  scenarios: GOB_SCENARIOS,
  decks: GOB_STARTER_DECKS,
  abilities: GOB_ABILITIES,
});
