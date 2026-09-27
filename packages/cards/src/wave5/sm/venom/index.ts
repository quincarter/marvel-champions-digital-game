import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { LEAVE_US_ALONE } from "./main-scheme.js";
import { SYMBIOTIC_STRENGTH } from "./symbiotic-strength.js";
import { VENOM } from "./villain.js";
import { VENOM_ENCOUNTER_SET } from "./encounter-set.js";

/**
 * The Venom scenario (`sm`, docs/phase7-wave5.md §2.2, the box's second): the villain (27073–27075, `villain.ts`),
 * the main scheme "Leave Us Alone!" (27076a/b, `main-scheme.ts`), Venom's own encounter set (27077–27083,
 * `encounter-set.ts`), and Symbiotic Strength, the scenario's other required set (27164–27169,
 * `symbiotic-strength.ts`).
 */
export const VENOM_ABILITIES: AbilityRegistry = mergeRegistries(
  VENOM,
  LEAVE_US_ALONE,
  VENOM_ENCOUNTER_SET,
  SYMBIOTIC_STRENGTH,
);

export { BELL_TOWER } from "./encounter-set.js";
