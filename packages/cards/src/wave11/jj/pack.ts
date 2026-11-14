import { JJ_CARDS, JJ_ENCOUNTER_SETS, JJ_PACK, JJ_SCENARIOS, JJ_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { wave11ModulesOf } from "../modules.js";

/**
 * The `jj` product as a built-in pack: the Jessica Jones hero pack.
 *
 * Its scripts are the registries of its `jj/…` modules in `../modules.ts` (`WAVE11_MODULES`), in that list's
 * order; the modules' own skipped refs stay listed there.
 */
export const JJ_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "jj", kind: "hero", name: JJ_PACK.name, product: JJ_PACK },
  cards: JJ_CARDS,
  encounterSets: JJ_ENCOUNTER_SETS,
  scenarios: JJ_SCENARIOS,
  decks: JJ_STARTER_DECKS,
  abilities: mergeRegistries(...wave11ModulesOf("jj").map((module) => module.registry)),
});
