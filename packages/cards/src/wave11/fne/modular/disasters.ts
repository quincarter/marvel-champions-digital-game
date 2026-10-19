import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * The Disasters modular set (docs/phase7-wave11-scenarios.md section S6).
 *
 * Cards (5):
 * - 60177 Mystic Incursion (environment)
 * - 60178 Sinking Ferry (environment)
 * - 60179 Towering Inferno (environment)
 * - 60180 Collapsing Bridge (side_scheme)
 * - 60181 Bystanders in Peril (treachery)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const FNE_MODULAR_DISASTERS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_MODULAR_DISASTERS_SKIPPED: Readonly<Record<string, string>> = {
  "60177.mystic-incursion-action": "wave 11 scripting in progress: fne/modular/disasters",
  "60178.sinking-ferry-action": "wave 11 scripting in progress: fne/modular/disasters",
  "60179.towering-inferno-action": "wave 11 scripting in progress: fne/modular/disasters",
  "60180.collapsing-bridge-forced-response": "wave 11 scripting in progress: fne/modular/disasters",
  "60181.when-revealed": "wave 11 scripting in progress: fne/modular/disasters",
  "60181.boost": "wave 11 scripting in progress: fne/modular/disasters",
};
