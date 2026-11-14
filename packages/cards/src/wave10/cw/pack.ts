import { CW_CARDS, CW_ENCOUNTER_SETS, CW_PACK, CW_SCENARIOS, CW_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { wave10ModulesOf } from "../modules.js";

/**
 * The `cw` product as a built-in pack: the Civil War box (MC56): Tigra and Hulkling, the four leaders, the sided main
 * schemes and modular sets, and the competitive cards. It has no campaign (MC56 rulebook: four preconstructed scenarios
 * and custom scenario building instead), so it is a `scenario` pack.
 *
 * Its scripts are the registries of its `cw/…` modules in `../modules.ts` (`WAVE10_MODULES`), in that list's
 * order; the modules' own skipped refs stay listed there.
 */
export const CW_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "cw", kind: "scenario", name: CW_PACK.name, product: CW_PACK },
  cards: CW_CARDS,
  encounterSets: CW_ENCOUNTER_SETS,
  scenarios: CW_SCENARIOS,
  decks: CW_STARTER_DECKS,
  abilities: mergeRegistries(...wave10ModulesOf("cw").map((module) => module.registry)),
});
