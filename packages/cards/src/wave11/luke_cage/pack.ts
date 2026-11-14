import {
  LUKE_CAGE_CARDS,
  LUKE_CAGE_ENCOUNTER_SETS,
  LUKE_CAGE_PACK,
  LUKE_CAGE_SCENARIOS,
  LUKE_CAGE_STARTER_DECKS,
} from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { wave11ModulesOf } from "../modules.js";

/**
 * The `luke_cage` product as a built-in pack: the Luke Cage hero pack.
 *
 * Its scripts are the registries of its `luke_cage/…` modules in `../modules.ts` (`WAVE11_MODULES`), in that list's
 * order; the modules' own skipped refs stay listed there.
 */
export const LUKE_CAGE_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "luke_cage", kind: "hero", name: LUKE_CAGE_PACK.name, product: LUKE_CAGE_PACK },
  cards: LUKE_CAGE_CARDS,
  encounterSets: LUKE_CAGE_ENCOUNTER_SETS,
  scenarios: LUKE_CAGE_SCENARIOS,
  decks: LUKE_CAGE_STARTER_DECKS,
  abilities: mergeRegistries(...wave11ModulesOf("luke_cage").map((module) => module.registry)),
});
