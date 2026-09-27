import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { SINISTER_SIX_MAIN_SCHEME } from "./main-scheme.js";
import { SINISTER_SIX_SCENARIO_CARDS } from "./scenario-cards.js";

/**
 * The Sinister Six scenario's own scenario-wide abilities (docs/phase7-wave5.md §1.5/§3.1/§3.2): the main scheme's
 * two lettered stages and Light at the End. The six villains themselves (Doctor Octopus, Electro, Hobgoblin, Kraven
 * the Hunter, Scorpion, Vulture, `sm` 27094–27099) and Guerrilla Tactics are separate, later agents' work — nothing
 * here registers an ability on them.
 */
export const SINISTER_SIX_ABILITIES: AbilityRegistry = mergeRegistries(
  SINISTER_SIX_MAIN_SCHEME,
  SINISTER_SIX_SCENARIO_CARDS,
);
