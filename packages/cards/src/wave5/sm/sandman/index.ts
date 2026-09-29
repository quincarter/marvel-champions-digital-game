import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { CITY_IN_CHAOS } from "./city-in-chaos.js";
import { HAPLESS_PEDESTRIANS } from "./main-scheme.js";
import { SANDMAN } from "./villain.js";
import { SANDMAN_ENCOUNTER_SET } from "./encounter-set.js";

/**
 * The Sandman scenario (`sm`, docs/phase7-wave5.md §2.2, the box's first): the villain (27061–27063, `villain.ts`),
 * the main scheme Hapless Pedestrians (27064a/b, `main-scheme.ts`), Sandman's own encounter set (27065–27072,
 * `encounter-set.ts`), and City in Chaos, the scenario's other required set (27127–27130, `city-in-chaos.ts`).
 */
export const SANDMAN_ABILITIES: AbilityRegistry = mergeRegistries(
  SANDMAN,
  HAPLESS_PEDESTRIANS,
  SANDMAN_ENCOUNTER_SET,
  CITY_IN_CHAOS,
);

export { CITY_STREETS } from "./encounter-set.js";
