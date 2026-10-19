import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Hammerhead (docs/phase7-wave11-scenarios.md section S6).
 *
 * Cards (9):
 * - 60086 Hammerhead (villain)
 * - 60089 Energy Gatling Gun (attachment)
 * - 60090 Hardheaded (attachment)
 * - 60091 Chameleon (minion)
 * - 60092 Maggia Enforcers (minion)
 * - 60093 Maggia Underboss (minion)
 * - 60094 Consolidate Power (side_scheme)
 * - 60095 Power Struggle (side_scheme)
 * - 60096 "Head First!" (treachery)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const FNE_VILLAINS_HAMMERHEAD: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_VILLAINS_HAMMERHEAD_SKIPPED: Readonly<Record<string, string>> = {
  "60086.hammerhead-forced-response": "wave 11 scripting in progress: fne/villains/hammerhead",
  "60087.hammerhead-forced-response": "wave 11 scripting in progress: fne/villains/hammerhead",
  "60088.hammerhead-forced-response": "wave 11 scripting in progress: fne/villains/hammerhead",
  "60089.energy-gatling-gun-forced-response": "wave 11 scripting in progress: fne/villains/hammerhead",
  "60090.hardheaded-constant": "wave 11 scripting in progress: fne/villains/hammerhead",
  "60090.hardheaded-action": "wave 11 scripting in progress: fne/villains/hammerhead",
  "60090.boost": "wave 11 scripting in progress: fne/villains/hammerhead",
  "60091.chameleon-constant": "wave 11 scripting in progress: fne/villains/hammerhead",
  "60091.when-revealed": "wave 11 scripting in progress: fne/villains/hammerhead",
  "60092.maggia-enforcers-constant": "wave 11 scripting in progress: fne/villains/hammerhead",
  "60093.maggia-underboss-forced-interrupt": "wave 11 scripting in progress: fne/villains/hammerhead",
  "60094.consolidate-power-forced-response": "wave 11 scripting in progress: fne/villains/hammerhead",
  "60095.when-revealed": "wave 11 scripting in progress: fne/villains/hammerhead",
  "60096.when-revealed-alter-ego": "wave 11 scripting in progress: fne/villains/hammerhead",
  "60096.when-revealed-hero": "wave 11 scripting in progress: fne/villains/hammerhead",
};
