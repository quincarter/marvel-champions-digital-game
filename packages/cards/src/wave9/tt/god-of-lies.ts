import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `tt/god-of-lies` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (29):
 * - 55027a Loki, God of Lies (villain)
 * - 55028a Worlds Collide (main_scheme)
 * - 55029a Loki the Rascal (villain)
 * - 55030a Loki the Miscreant (villain)
 * - 55031a Loki the Knave (villain)
 * - 55032a Loki the Wretch (villain)
 * - 55033a Mischief and Mayhem (main_scheme)
 * - 55034a Intense Focus (attachment)
 * - 55035 Wrapped in Chains (attachment)
 * - 55036 Dark Scepter (attachment)
 * - 55037 Draugr Buddy (minion)
 * - 55038 Grendell (minion)
 * - 55039 Malekith (minion)
 * - 55040 Minotaur (minion)
 * - 55041 The Mangog (minion)
 * - 55042 Fenris Wolf (minion)
 * - 55043 Hraesvelgr (minion)
 * - 55044 Laufey (minion)
 * - 55045 Aura of Stasis (side_scheme)
 * - 55046 Door Between Worlds (side_scheme)
 * - 55047 Lofty Goals (side_scheme)
 * - 55048 New Jotunheim (side_scheme)
 * - 55049 Dark Arts (treachery)
 * - 55050 Dirty Trick (treachery)
 * - 55051 Stories and Lies (treachery)
 * - 55052 Domineering Force (environment)
 * - 55053 Feigned Retreat (environment)
 * - 55054 Mounting Resistance (environment)
 * - 55055 Unified Front (environment)
 */
export const GOD_OF_LIES: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const GOD_OF_LIES_SKIPPED: Readonly<Record<string, string>> = {};
