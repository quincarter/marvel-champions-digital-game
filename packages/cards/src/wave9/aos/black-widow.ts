import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/black-widow` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (14):
 * - 50064 Black Widow (villain)
 * - 50067a The Widow's Web (main_scheme)
 * - 50068 Black Widow's Gauntlet (attachment)
 * - 50069 Grappling Hook (attachment)
 * - 50070 Night Vision Goggles (attachment)
 * - 50071 Stun Net (attachment)
 * - 50072 A.I.M. Commando (minion)
 * - 50073 A.I.M. Grunt (minion)
 * - 50074 Automated Defenses (side_scheme)
 * - 50075 Destroy Evidence (side_scheme)
 * - 50076 Attacrobatics (treachery)
 * - 50077 Covert Ops (treachery)
 * - 50078 Dance of Death (treachery)
 * - 50079 Widow's Bite (treachery)
 */
export const BLACK_WIDOW: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const BLACK_WIDOW_SKIPPED: Readonly<Record<string, string>> = {};
