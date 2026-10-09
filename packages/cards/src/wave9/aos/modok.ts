import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/modok` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (26):
 * - 50103a M.O.D.O.K. (villain)
 * - 50104a Upgrading Adaptoids (main_scheme)
 * - 50105a Holding Cell (environment)
 * - 50105b Flying Inhuman (ally)
 * - 50106a Holding Cell (environment)
 * - 50106b Psionic Inhuman (ally)
 * - 50107a Holding Cell (environment)
 * - 50107b Sarah Garza (ally)
 * - 50108a Holding Cell (environment)
 * - 50108b Strong Inhuman (ally)
 * - 50109 Flying Upgrade (environment)
 * - 50110 Psionic Upgrade (environment)
 * - 50111 Sarah Garza Upgrade (environment)
 * - 50112 Strong Upgrade (environment)
 * - 50113 Adaptoid (minion)
 * - 50114 Automated Mobile Unit (attachment)
 * - 50115 Focusing Crystal (attachment)
 * - 50116 Nanobots (attachment)
 * - 50117 Psionic Force Field (attachment)
 * - 50118 Psionic Machetes (attachment)
 * - 50119 Reverse Engineering (attachment)
 * - 50120 A.I.M. Jailer (minion)
 * - 50121 Hostage Situation (side_scheme)
 * - 50122 Psionic Enhancement (side_scheme)
 * - 50123 "It's Alive!" (treachery)
 * - 50124 Psionic Blast (treachery)
 */
export const MODOK: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const MODOK_SKIPPED: Readonly<Record<string, string>> = {};
