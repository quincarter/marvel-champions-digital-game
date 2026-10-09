import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/aspect-basic` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (29):
 * - 50012 Victoria Hand (ally)
 * - 50013 Slingshot (ally)
 * - 50014 Organizational Support (resource)
 * - 50015 Agents of S.H.I.E.L.D. (support)
 * - 50016 Command Team (support)
 * - 50017 The Circe (support)
 * - 50018 The Bellerophon (support)
 * - 50019 The Douglass (support)
 * - 50020 The Pericles (support)
 * - 50021 Dum Dum Dugan (ally)
 * - 50022 Grant Ward (ally)
 * - 50023 Melinda May (ally)
 * - 50024 Super Spies (event)
 * - 50025 Energy (resource)
 * - 50026 Genius (resource)
 * - 50027 Strength (resource)
 * - 50028 Front Organization (support)
 * - 50047 Agent Coulson (ally)
 * - 50048 Quake (ally)
 * - 50049 Global Logistics (event)
 * - 50050 Informant (upgrade)
 * - 50051 Intelligence (upgrade)
 * - 50052 Prism Dust (upgrade)
 * - 50053 Under Surveillance (upgrade)
 * - 50054 Nick Fury, Sr. (ally)
 * - 50055 Jemma Simmons (support)
 * - 50056 Leo Fitz (support)
 * - 50057 Sky-Destroyer (support)
 * - 50058 Practiced Plan (upgrade)
 */
export const AOS_ASPECT_BASIC: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const AOS_ASPECT_BASIC_SKIPPED: Readonly<Record<string, string>> = {};
