import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Purple Man (docs/phase7-wave11-scenarios.md section S6).
 *
 * Cards (11):
 * - 60097 Purple Man (villain)
 * - 60100 Converted (attachment)
 * - 60101 Firefighter (minion)
 * - 60102 Judge (minion)
 * - 60103 Security Guard (minion)
 * - 60104 Skater Punk (minion)
 * - 60105 "Fight." (obligation)
 * - 60106 "Protect." (obligation)
 * - 60107 "Serve." (obligation)
 * - 60108 Power of Suggestion (side_scheme)
 * - 60109 Sway the Masses (treachery)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const FNE_VILLAINS_PURPLE_MAN: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_VILLAINS_PURPLE_MAN_SKIPPED: Readonly<Record<string, string>> = {
  "60097.purple-man-constant": "wave 11 scripting in progress: fne/villains/purple-man",
  "60097.purple-man-constant-2": "wave 11 scripting in progress: fne/villains/purple-man",
  "60098.purple-man-constant": "wave 11 scripting in progress: fne/villains/purple-man",
  "60098.purple-man-constant-2": "wave 11 scripting in progress: fne/villains/purple-man",
  "60099.purple-man-constant": "wave 11 scripting in progress: fne/villains/purple-man",
  "60099.purple-man-constant-2": "wave 11 scripting in progress: fne/villains/purple-man",
  "60100.converted-constant": "wave 11 scripting in progress: fne/villains/purple-man",
  "60100.when-revealed": "wave 11 scripting in progress: fne/villains/purple-man",
  "60101.firefighter-constant": "wave 11 scripting in progress: fne/villains/purple-man",
  "60101.when-defeated": "wave 11 scripting in progress: fne/villains/purple-man",
  "60102.when-defeated": "wave 11 scripting in progress: fne/villains/purple-man",
  "60103.when-defeated": "wave 11 scripting in progress: fne/villains/purple-man",
  "60104.when-defeated": "wave 11 scripting in progress: fne/villains/purple-man",
  "60105.fight-constant": "wave 11 scripting in progress: fne/villains/purple-man",
  "60105.fight-forced-action": "wave 11 scripting in progress: fne/villains/purple-man",
  "60106.protect-constant": "wave 11 scripting in progress: fne/villains/purple-man",
  "60106.protect-forced-action": "wave 11 scripting in progress: fne/villains/purple-man",
  "60107.serve-constant": "wave 11 scripting in progress: fne/villains/purple-man",
  "60107.serve-forced-action": "wave 11 scripting in progress: fne/villains/purple-man",
  "60108.power-of-suggestion-constant": "wave 11 scripting in progress: fne/villains/purple-man",
  "60109.when-revealed": "wave 11 scripting in progress: fne/villains/purple-man",
};
