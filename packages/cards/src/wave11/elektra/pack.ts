import {
  ELEKTRA_CARDS,
  ELEKTRA_ENCOUNTER_SETS,
  ELEKTRA_PACK,
  ELEKTRA_SCENARIOS,
  ELEKTRA_STARTER_DECKS,
} from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { wave11ModulesOf } from "../modules.js";

/**
 * The `elektra` product as a built-in pack: the Elektra hero pack.
 *
 * Its scripts are the registries of its `elektra/…` modules in `../modules.ts` (`WAVE11_MODULES`), in that list's order;
 * the modules' own skipped refs stay listed there.
 *
 * Released 2026-11-25 (card data from MarvelCDB, scans by bluefireF5ran; docs/phase7-elektra-iron-fist.md). It was
 * `status: "not-ready"` before that.
 */
export const ELEKTRA_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "elektra", kind: "hero", name: ELEKTRA_PACK.name, product: ELEKTRA_PACK },
  cards: ELEKTRA_CARDS,
  encounterSets: ELEKTRA_ENCOUNTER_SETS,
  scenarios: ELEKTRA_SCENARIOS,
  decks: ELEKTRA_STARTER_DECKS,
  abilities: mergeRegistries(...wave11ModulesOf("elektra").map((module) => module.registry)),
});
