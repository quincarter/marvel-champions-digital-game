import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { SINISTER_SIX_MAIN_SCHEME } from "./main-scheme.js";
import { SINISTER_SIX_SCENARIO_CARDS } from "./scenario-cards.js";
import { SINISTER_SIX_VILLAINS } from "./villains.js";

/**
 * The Sinister Six scenario's own scenario-wide abilities (docs/phase7-wave5.md §1.5/§3.1/§3.2): the main scheme's
 * two lettered stages, Light at the End, and the six villains themselves (Doctor Octopus registered so far; Electro,
 * Hobgoblin, Kraven the Hunter, Scorpion and Vulture, `sm` 27095–27099, share `villains.ts`'s own `sinisterSixVillain`
 * helper and are separate, later agents' work). Guerrilla Tactics is separate, later agents' work too.
 */
export const SINISTER_SIX_ABILITIES: AbilityRegistry = mergeRegistries(
  SINISTER_SIX_MAIN_SCHEME,
  SINISTER_SIX_SCENARIO_CARDS,
  SINISTER_SIX_VILLAINS,
);
