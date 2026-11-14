import { ROGUE_CARDS, ROGUE_ENCOUNTER_SETS, ROGUE_PACK, ROGUE_SCENARIOS, ROGUE_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { REAVERS_ABILITIES } from "./reavers/index.js";
import { ROGUE_HERO_ABILITIES } from "./rogue/index.js";

/**
 * The `rogue` product (MC38) as a built-in pack: its cards and every script they need. Her own hero folder
 * (`rogue/`: identity and Touched so far) and the Reavers modular set (`reavers/`, 38029-38035).
 */
export const ROGUE_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "rogue", kind: "hero", name: ROGUE_PACK.name, product: ROGUE_PACK },
  cards: ROGUE_CARDS,
  encounterSets: ROGUE_ENCOUNTER_SETS,
  scenarios: ROGUE_SCENARIOS,
  decks: ROGUE_STARTER_DECKS,
  abilities: mergeRegistries(ROGUE_HERO_ABILITIES, REAVERS_ABILITIES),
});
