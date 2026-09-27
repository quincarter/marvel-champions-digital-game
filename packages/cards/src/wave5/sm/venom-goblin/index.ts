import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { SKIES_OVER_NEW_YORK } from "./main-scheme.js";
import { VENOM_GOBLIN_VILLAIN } from "./villain.js";
import { VENOM_GOBLIN_ENCOUNTER_SET } from "./encounter-set.js";

/**
 * The Venom Goblin scenario (`sm`, docs/phase7-wave5.md §1.1/§2.2/§3.3/§3.4/§3.9, the box's fifth and last). The
 * main scheme "Skies Over New York" (27116a/b) → Lower/Midtown/Upper Manhattan (27117a/b–27119a/b, `main-scheme.ts`)
 * is scripted here; the villain (27113–27115, `villain.ts`) and Venom Goblin's own encounter set plus We Are One
 * (27120–27126, `encounter-set.ts`) are later agents' work (both placeholder modules, module docblocks).
 */
export const VENOM_GOBLIN_ABILITIES: AbilityRegistry = mergeRegistries(
  SKIES_OVER_NEW_YORK,
  VENOM_GOBLIN_VILLAIN,
  VENOM_GOBLIN_ENCOUNTER_SET,
);
