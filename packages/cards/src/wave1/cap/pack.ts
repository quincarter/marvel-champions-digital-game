import { CAP_CARDS, CAP_ENCOUNTER_SETS, CAP_PACK, CAP_SCENARIOS, CAP_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { CAP_ABILITIES } from "./index.js";

/** The `cap` product as a built-in pack: its own cards and scripts, not Core's reprints. */
export const CAP_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "cap", kind: "hero", name: CAP_PACK.name, product: CAP_PACK },
  cards: CAP_CARDS,
  encounterSets: CAP_ENCOUNTER_SETS,
  scenarios: CAP_SCENARIOS,
  decks: CAP_STARTER_DECKS,
  abilities: CAP_ABILITIES,
});
