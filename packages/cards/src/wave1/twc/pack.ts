import { TWC_CARDS, TWC_ENCOUNTER_SETS, TWC_PACK, TWC_SCENARIOS, TWC_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { TWC_ABILITIES } from "./index.js";

/** The `twc` product as a built-in pack: its own cards and scripts, not Core's reprints. */
export const TWC_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "twc", kind: "scenario", name: TWC_PACK.name, product: TWC_PACK },
  cards: TWC_CARDS,
  encounterSets: TWC_ENCOUNTER_SETS,
  scenarios: TWC_SCENARIOS,
  decks: TWC_STARTER_DECKS,
  abilities: TWC_ABILITIES,
});
