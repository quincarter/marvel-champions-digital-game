import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * The Stop the Presses! scenario (docs/phase7-wave11-scenarios.md section S6).
 *
 * Cards (8):
 * - 60151a Stop the Presses! (main_scheme)
 * - 60152 Daily Bugle (environment)
 * - 60153 Ben Urich (support)
 * - 60154 Betty Brant (support)
 * - 60155 J. Jonah Jameson (support)
 * - 60156 Robbie Robertson (support)
 * - 60157 Exclusive Interview (side_scheme)
 * - 60158 Breaking News (treachery)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const FNE_SCENARIOS_STOP_THE_PRESSES: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_SCENARIOS_STOP_THE_PRESSES_SKIPPED: Readonly<Record<string, string>> = {
  "60151a.setup": "wave 11 scripting in progress: fne/scenarios/stop-the-presses",
  "60151b.stop-the-presses-forced-response": "wave 11 scripting in progress: fne/scenarios/stop-the-presses",
  "60151b.stop-the-presses-constant": "wave 11 scripting in progress: fne/scenarios/stop-the-presses",
  "60152.daily-bugle-action": "wave 11 scripting in progress: fne/scenarios/stop-the-presses",
  "60153.ben-urich-action": "wave 11 scripting in progress: fne/scenarios/stop-the-presses",
  "60154.betty-brant-interrupt": "wave 11 scripting in progress: fne/scenarios/stop-the-presses",
  "60155.j-jonah-jameson-action": "wave 11 scripting in progress: fne/scenarios/stop-the-presses",
  "60156.robbie-robertson-response": "wave 11 scripting in progress: fne/scenarios/stop-the-presses",
  "60157.exclusive-interview-constant": "wave 11 scripting in progress: fne/scenarios/stop-the-presses",
  "60157.when-revealed": "wave 11 scripting in progress: fne/scenarios/stop-the-presses",
  "60158.when-revealed": "wave 11 scripting in progress: fne/scenarios/stop-the-presses",
  "60158.boost": "wave 11 scripting in progress: fne/scenarios/stop-the-presses",
};
