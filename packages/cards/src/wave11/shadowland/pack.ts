import {
  SHADOWLAND_CARDS,
  SHADOWLAND_ENCOUNTER_SETS,
  SHADOWLAND_PACK,
  SHADOWLAND_SCENARIOS,
  SHADOWLAND_STARTER_DECKS,
} from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { wave11ModulesOf } from "../modules.js";

/**
 * The `shadowland` product as a built-in pack: Shadowland (MC65): its scenarios and modular sets. It carries a three-
 * scenario campaign (`SHADOWLAND_CAMPAIGN`), so it is a `campaign` pack.
 *
 * Its scripts are the registries of its `shadowland/…` modules in `../modules.ts` (`WAVE11_MODULES`), in that list's
 * order; the modules' own skipped refs stay listed there.
 */
export const SHADOWLAND_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "shadowland", kind: "campaign", name: SHADOWLAND_PACK.name, product: SHADOWLAND_PACK },
  cards: SHADOWLAND_CARDS,
  encounterSets: SHADOWLAND_ENCOUNTER_SETS,
  scenarios: SHADOWLAND_SCENARIOS,
  decks: SHADOWLAND_STARTER_DECKS,
  abilities: mergeRegistries(...wave11ModulesOf("shadowland").map((module) => module.registry)),
});
