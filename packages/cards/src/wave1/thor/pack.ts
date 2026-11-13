import { THOR_CARDS, THOR_ENCOUNTER_SETS, THOR_PACK, THOR_SCENARIOS, THOR_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { THOR_ABILITIES } from "./index.js";

/** The `thor` product as a built-in pack: its own cards and scripts, not Core's reprints. */
export const THOR_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "thor", kind: "hero", name: THOR_PACK.name, product: THOR_PACK },
  cards: THOR_CARDS,
  encounterSets: THOR_ENCOUNTER_SETS,
  scenarios: THOR_SCENARIOS,
  decks: THOR_STARTER_DECKS,
  abilities: THOR_ABILITIES,
});
