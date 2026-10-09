import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `tt/enchantress` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (23):
 * - 55001 Enchantress (villain)
 * - 55004a Prime Real Estate (main_scheme)
 * - 55006 Future of Despair (side_scheme)
 * - 55007a Hypnotic Gaze (attachment)
 * - 55008a Hypnotic Gaze (attachment)
 * - 55009a Hypnotic Gaze (attachment)
 * - 55010a Hypnotic Gaze (attachment)
 * - 55011a Hypnotic Gaze (attachment)
 * - 55012 Alluring Call (attachment)
 * - 55013 Kiss of Temptation (attachment)
 * - 55014 Love Concoction (attachment)
 * - 55015 Seduced (attachment)
 * - 55016 Crown of the Enchantress (attachment)
 * - 55017 Enthralled Lackey (minion)
 * - 55018 Enthralled Brute (minion)
 * - 55019 Sindr (minion)
 * - 55020 Ulik (minion)
 * - 55021 Law of Attraction (side_scheme)
 * - 55022 Spellbound (side_scheme)
 * - 55023 "Do My Bidding" (treachery)
 * - 55024 Magical Restraints (treachery)
 * - 55025 Spell Blast (treachery)
 * - 55026 Spell Shards (treachery)
 */
export const ENCHANTRESS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const ENCHANTRESS_SKIPPED: Readonly<Record<string, string>> = {};
