import { HLK_CARDS, HLK_ENCOUNTER_SETS, HLK_PACK, HLK_SCENARIOS, HLK_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { HLK_ABILITIES } from "./index.js";

/** The `hlk` product as a built-in pack: its own cards and scripts, not Core's reprints. */
export const HLK_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "hlk", kind: "hero", name: HLK_PACK.name, product: HLK_PACK },
  cards: HLK_CARDS,
  encounterSets: HLK_ENCOUNTER_SETS,
  scenarios: HLK_SCENARIOS,
  decks: HLK_STARTER_DECKS,
  abilities: HLK_ABILITIES,
});
