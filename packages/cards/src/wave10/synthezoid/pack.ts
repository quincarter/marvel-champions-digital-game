import {
  SYNTHEZOID_CARDS,
  SYNTHEZOID_ENCOUNTER_SETS,
  SYNTHEZOID_PACK,
  SYNTHEZOID_SCENARIOS,
  SYNTHEZOID_STARTER_DECKS,
} from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { wave10ModulesOf } from "../modules.js";

/**
 * The `synthezoid` product as a built-in pack: Synthezoid Smackdown (MC57): the She-Hulk and Vision leaders, their main
 * schemes and modular sets, and the competitive cards.
 *
 * Its scripts are the registries of its `synthezoid/…` modules in `../modules.ts` (`WAVE10_MODULES`), in that list's
 * order; the modules' own skipped refs stay listed there.
 */
export const SYNTHEZOID_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "synthezoid", kind: "scenario", name: SYNTHEZOID_PACK.name, product: SYNTHEZOID_PACK },
  cards: SYNTHEZOID_CARDS,
  encounterSets: SYNTHEZOID_ENCOUNTER_SETS,
  scenarios: SYNTHEZOID_SCENARIOS,
  decks: SYNTHEZOID_STARTER_DECKS,
  abilities: mergeRegistries(...wave10ModulesOf("synthezoid").map((module) => module.registry)),
});
