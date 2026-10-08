import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Campaign-only encounter set `age_of_apocalypse` (campaign mode only; docs/phase7-wave8.md §1.28, §3.41).
 *
 * **Nothing here is registered.** Both cards are a choice between a mission-area effect and an ordinary one, and each
 * boost is a mission-area effect:
 * Agent of Apocalypse: "Choose: either add Agent of Apocalypse to the mission area, or it activates against you";
 *   the boost deals 1 damage to an ally at the mission.
 * Worldwide Crisis: "Choose: either place 3 threat on the [MISSION] side scheme, or take 1 damage and this card
 *   gains surge"; the boost places 1 threat on the [MISSION] side scheme.
 * The area (tasks 31 and 32, section 3.33), and for Agent of Apocalypse the minion that lives there with dashed stats
 * and is never engaged (section 3.41), are not in the engine yet, and the DSL has no query for "at the mission" to type
 * even the half of a choice that is ordinary. See `AGE_OF_APOCALYPSE_SKIPPED`.
 *
 * Cards (2):
 * - 45164 Agent of Apocalypse (minion)
 * - 45165 Worldwide Crisis (treachery)
 */
export const AGE_OF_APOCALYPSE: AbilityRegistry = defineAbilities({});

/** Unregistered refs and why, with the engine queue task (spec section 8.2) each waits on. */
export const AGE_OF_APOCALYPSE_SKIPPED: Readonly<Record<string, string>> = {
  "45164.when-revealed":
    "'add Agent of Apocalypse to the mission area' needs the mission area (task 31) and the minion's life there, never engaged (section 3.41)",
  "45164.boost": "'damage to an ally at the mission' needs the mission area and its closed filter (tasks 31 and 32)",
  "45165.when-revealed":
    "'place 3 threat on the [MISSION] side scheme' needs the mission area and a query that reaches into it (tasks 31 and 32)",
  "45165.boost": "'1 threat on the [MISSION] side scheme' needs the same area query (tasks 31 and 32)",
};
