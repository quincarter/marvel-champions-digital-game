import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { SINISTER_SIX_ENCOUNTER_ATTACHMENTS } from "./encounter-attachments.js";
import { GUERRILLA_TACTICS } from "./guerrilla-tactics.js";
import { SINISTER_SIX_MAIN_SCHEME } from "./main-scheme.js";
import { SINISTER_SIX_SCENARIO_CARDS } from "./scenario-cards.js";
import { SINISTER_SIX_TREACHERIES } from "./treacheries.js";
import { SINISTER_SIX_VILLAINS } from "./villains.js";

/**
 * The Sinister Six scenario's own scenario-wide abilities (docs/phase7-wave5.md §1.5/§3.1/§3.2): the main scheme's
 * two lettered stages, Light at the End, its encounter attachments and Brute Force Barricade (27103–27107), its
 * treacheries (27108–27112), the six villains (`villains.ts`, `sinisterSixVillain`, `sm` 27094–27099), and its other
 * modular set, Guerrilla Tactics (`guerrilla-tactics.ts`, `sm` 27142–27146).
 */
export const SINISTER_SIX_ABILITIES: AbilityRegistry = mergeRegistries(
  SINISTER_SIX_MAIN_SCHEME,
  SINISTER_SIX_SCENARIO_CARDS,
  SINISTER_SIX_VILLAINS,
  SINISTER_SIX_ENCOUNTER_ATTACHMENTS,
  SINISTER_SIX_TREACHERIES,
  GUERRILLA_TACTICS,
);
