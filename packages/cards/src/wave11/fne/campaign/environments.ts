import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * The campaign environments (docs/phase7-wave11-scenarios.md section S6).
 *
 * Cards (5):
 * - 60205a Art Museum Heist (environment)
 * - 60206a The Getaway (environment)
 * - 60207a Protection Racket (environment)
 * - 60208a The Raft Breakout (environment)
 * - 60209a Stop the Presses! (environment)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const FNE_CAMPAIGN_ENVIRONMENTS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_CAMPAIGN_ENVIRONMENTS_SKIPPED: Readonly<Record<string, string>> = {
  "60205a.setup": "wave 11 scripting in progress: fne/campaign/environments",
  "60205b.setup": "wave 11 scripting in progress: fne/campaign/environments",
  "60206a.setup": "wave 11 scripting in progress: fne/campaign/environments",
  "60206b.the-getaway-constant": "wave 11 scripting in progress: fne/campaign/environments",
  "60206b.setup": "wave 11 scripting in progress: fne/campaign/environments",
  "60207a.setup": "wave 11 scripting in progress: fne/campaign/environments",
  "60207b.setup": "wave 11 scripting in progress: fne/campaign/environments",
  "60208a.setup": "wave 11 scripting in progress: fne/campaign/environments",
  "60208b.setup": "wave 11 scripting in progress: fne/campaign/environments",
  "60209a.setup": "wave 11 scripting in progress: fne/campaign/environments",
  "60209b.setup": "wave 11 scripting in progress: fne/campaign/environments",
};
