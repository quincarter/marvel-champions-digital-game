import { GAMBIT_CARDS, GAMBIT_ENCOUNTER_SETS, GAMBIT_PACK, GAMBIT_SCENARIOS, GAMBIT_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { EXODUS_ABILITIES } from "./exodus/index.js";
import { GAMBIT_HERO_ABILITIES } from "./gambit/index.js";

/**
 * The `gambit` product (MC37) as a built-in pack: its cards and every script they need. One folder per hero
 * (`gambit/`) and the Exodus modular set (`exodus/`, 37032-37035).
 */
export const GAMBIT_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "gambit", kind: "hero", name: GAMBIT_PACK.name, product: GAMBIT_PACK },
  cards: GAMBIT_CARDS,
  encounterSets: GAMBIT_ENCOUNTER_SETS,
  scenarios: GAMBIT_SCENARIOS,
  decks: GAMBIT_STARTER_DECKS,
  abilities: mergeRegistries(GAMBIT_HERO_ABILITIES, EXODUS_ABILITIES),
});
