import {
  HERCULES_CARDS,
  HERCULES_ENCOUNTER_SETS,
  HERCULES_PACK,
  HERCULES_SCENARIOS,
  HERCULES_STARTER_DECKS,
} from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { wave10ModulesOf } from "../modules.js";

/**
 * The `hercules` product as a built-in pack: the Hercules hero pack.
 *
 * Its scripts are the registries of its `hercules/…` modules in `../modules.ts` (`WAVE10_MODULES`), in that list's
 * order; the modules' own skipped refs stay listed there.
 */
export const HERCULES_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "hercules", kind: "hero", name: HERCULES_PACK.name, product: HERCULES_PACK },
  cards: HERCULES_CARDS,
  encounterSets: HERCULES_ENCOUNTER_SETS,
  scenarios: HERCULES_SCENARIOS,
  decks: HERCULES_STARTER_DECKS,
  abilities: mergeRegistries(...wave10ModulesOf("hercules").map((module) => module.registry)),
});
