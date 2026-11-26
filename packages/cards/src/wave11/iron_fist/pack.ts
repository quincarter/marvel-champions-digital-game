import {
  IRON_FIST_CARDS,
  IRON_FIST_ENCOUNTER_SETS,
  IRON_FIST_PACK,
  IRON_FIST_SCENARIOS,
  IRON_FIST_STARTER_DECKS,
} from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { wave11ModulesOf } from "../modules.js";

/**
 * The `iron_fist` product as a built-in pack: the Iron Fist hero pack.
 *
 * Its scripts are the registries of its `iron_fist/…` modules in `../modules.ts` (`WAVE11_MODULES`), in that list's order;
 * the modules' own skipped refs stay listed there.
 *
 * Released 2026-11-25 (card data from MarvelCDB, scans by bluefireF5ran; docs/phase7-elektra-iron-fist.md). It was
 * `status: "not-ready"` before that.
 */
export const IRON_FIST_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "iron_fist", kind: "hero", name: IRON_FIST_PACK.name, product: IRON_FIST_PACK },
  cards: IRON_FIST_CARDS,
  encounterSets: IRON_FIST_ENCOUNTER_SETS,
  scenarios: IRON_FIST_SCENARIOS,
  decks: IRON_FIST_STARTER_DECKS,
  abilities: mergeRegistries(...wave11ModulesOf("iron_fist").map((module) => module.registry)),
});
