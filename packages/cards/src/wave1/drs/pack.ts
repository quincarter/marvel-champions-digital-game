import { DRS_CARDS, DRS_ENCOUNTER_SETS, DRS_PACK, DRS_SCENARIOS, DRS_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { wave1ReprintAbilitiesOf } from "../reprints.js";
import { DRS_ABILITIES } from "./index.js";

/** The `drs` product as a built-in pack: its cards and every script they need, Core reprint aliases included. */
export const DRS_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "drs", kind: "hero", name: DRS_PACK.name, product: DRS_PACK },
  cards: DRS_CARDS,
  encounterSets: DRS_ENCOUNTER_SETS,
  scenarios: DRS_SCENARIOS,
  decks: DRS_STARTER_DECKS,
  abilities: mergeRegistries(wave1ReprintAbilitiesOf(DRS_CARDS), DRS_ABILITIES),
});
