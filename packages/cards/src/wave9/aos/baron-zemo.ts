import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/baron-zemo` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (11):
 * - 50165a Baron Zemo (villain)
 * - 50166a Baron Zemo (villain)
 * - 50167a Zemo's Manipulations (main_scheme)
 * - 50170 Baron Zemo's Sword (attachment)
 * - 50171 Reluctant Foe (attachment)
 * - 50172 S.H.I.E.L.D. Agent (minion)
 * - 50173 Divided Loyalties (side_scheme)
 * - 50174 Undermine Support (side_scheme)
 * - 50175 Battle of Wits (treachery)
 * - 50176 Might Makes Right (treachery)
 * - 50177 The Ends Justify the Means (treachery)
 */
export const BARON_ZEMO: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const BARON_ZEMO_SKIPPED: Readonly<Record<string, string>> = {};
