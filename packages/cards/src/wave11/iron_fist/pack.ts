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
 * `status: "not-ready"`: the cards are in the pool, but the pack's cards are still being transcribed and scripted, so
 * the game doesn't offer its hero yet (`NOT_READY_PACK_CODES`). Delete the status to release it
 * (docs/phase7-elektra-iron-fist.md).
 */
export const IRON_FIST_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "iron_fist", kind: "hero", name: IRON_FIST_PACK.name, product: IRON_FIST_PACK, status: "not-ready" },
  cards: IRON_FIST_CARDS,
  encounterSets: IRON_FIST_ENCOUNTER_SETS,
  scenarios: IRON_FIST_SCENARIOS,
  decks: IRON_FIST_STARTER_DECKS,
  abilities: mergeRegistries(...wave11ModulesOf("iron_fist").map((module) => module.registry)),
});
