import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * The Tombstone modular set (docs/phase7-wave11-scenarios.md section S6).
 *
 * Cards (5):
 * - 60195 Cold as Ice (attachment)
 * - 60196 Hard as Marble (attachment)
 * - 60197 Beetle (minion)
 * - 60198 Tombstone (minion)
 * - 60199 Hit List (side_scheme)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const FNE_MODULAR_TOMBSTONE: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_MODULAR_TOMBSTONE_SKIPPED: Readonly<Record<string, string>> = {
  "60195.cold-as-ice-constant": "wave 11 scripting in progress: fne/modular/tombstone",
  "60195.cold-as-ice-forced-response": "wave 11 scripting in progress: fne/modular/tombstone",
  "60196.hard-as-marble-constant": "wave 11 scripting in progress: fne/modular/tombstone",
  "60196.hard-as-marble-forced-response": "wave 11 scripting in progress: fne/modular/tombstone",
  "60197.when-revealed": "wave 11 scripting in progress: fne/modular/tombstone",
  "60198.boost": "wave 11 scripting in progress: fne/modular/tombstone",
  "60199.hit-list-forced-response": "wave 11 scripting in progress: fne/modular/tombstone",
};
