import { FNE_CARDS, FNE_ENCOUNTER_SETS, FNE_PACK, FNE_SCENARIOS, FNE_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { wave11ModulesOf } from "../modules.js";

/**
 * The `fne` product as a built-in pack: the Fear No Evil box (MC60): Daredevil and Echo, the villains, scenarios,
 * modular sets and campaign cards.
 *
 * Its scripts are the registries of its `fne/…` modules in `../modules.ts` (`WAVE11_MODULES`), in that list's
 * order; the modules' own skipped refs stay listed there.
 */
export const FNE_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "fne", kind: "campaign", name: FNE_PACK.name, product: FNE_PACK },
  cards: FNE_CARDS,
  encounterSets: FNE_ENCOUNTER_SETS,
  scenarios: FNE_SCENARIOS,
  decks: FNE_STARTER_DECKS,
  abilities: mergeRegistries(...wave11ModulesOf("fne").map((module) => module.registry)),
});
