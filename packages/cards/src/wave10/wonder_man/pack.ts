import {
  WONDER_MAN_CARDS,
  WONDER_MAN_ENCOUNTER_SETS,
  WONDER_MAN_PACK,
  WONDER_MAN_SCENARIOS,
  WONDER_MAN_STARTER_DECKS,
} from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { wave10ModulesOf } from "../modules.js";

/**
 * The `wonder_man` product as a built-in pack: the Wonder Man hero pack.
 *
 * Its scripts are the registries of its `wonder_man/…` modules in `../modules.ts` (`WAVE10_MODULES`), in that list's
 * order; the modules' own skipped refs stay listed there.
 */
export const WONDER_MAN_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "wonder_man", kind: "hero", name: WONDER_MAN_PACK.name, product: WONDER_MAN_PACK },
  cards: WONDER_MAN_CARDS,
  encounterSets: WONDER_MAN_ENCOUNTER_SETS,
  scenarios: WONDER_MAN_SCENARIOS,
  decks: WONDER_MAN_STARTER_DECKS,
  abilities: mergeRegistries(...wave10ModulesOf("wonder_man").map((module) => module.registry)),
});
