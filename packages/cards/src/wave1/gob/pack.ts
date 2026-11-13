import { GOB_CARDS, GOB_ENCOUNTER_SETS, GOB_PACK, GOB_SCENARIOS, GOB_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { wave1ReprintAbilitiesOf } from "../reprints.js";
import { GOB_ABILITIES } from "./index.js";

/** The `gob` product as a built-in pack: its cards and every script they need, Core reprint aliases included. */
export const GOB_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "gob", kind: "scenario", name: GOB_PACK.name, product: GOB_PACK },
  cards: GOB_CARDS,
  encounterSets: GOB_ENCOUNTER_SETS,
  scenarios: GOB_SCENARIOS,
  decks: GOB_STARTER_DECKS,
  abilities: mergeRegistries(wave1ReprintAbilitiesOf(GOB_CARDS), GOB_ABILITIES),
});
