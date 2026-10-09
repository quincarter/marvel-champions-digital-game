import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/the-leaper` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (4):
 * - 50161 Batroc (minion)
 * - 50162 Coup de Foudre (side_scheme)
 * - 50163 Batroc the Leaper (treachery)
 * - 50164 Parcours du Combattant (treachery)
 */
export const THE_LEAPER: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const THE_LEAPER_SKIPPED: Readonly<Record<string, string>> = {};
