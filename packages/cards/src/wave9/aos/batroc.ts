import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/batroc` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (10):
 * - 50086a Batroc (villain)
 * - 50087a Infiltrate A.I.M. Island Embassy (main_scheme)
 * - 50090a Alert Level (environment)
 * - 50091 Rescued Captive (ally)
 * - 50092 Heightened Reflexes (attachment)
 * - 50093 Embassy Guard (minion)
 * - 50094 Embassy Patrol (minion)
 * - 50095 Commandeer Security Office (side_scheme)
 * - 50096 Leaping Kick (treachery)
 * - 50097 Security Cameras (treachery)
 */
export const BATROC: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const BATROC_SKIPPED: Readonly<Record<string, string>> = {};
