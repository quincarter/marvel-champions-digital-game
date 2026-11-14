import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 11 scripting module `iron_fist/iron-fist/identity` (docs/phase7-elektra-iron-fist.md). Scaffold: a registry holding only the reprint aliases
 * (an empty one when there are none) with every other ref skipped, so scripting it is editing this file and its test.
 *
 * Cards (1):
 * - 64001a Iron Fist (hero_identity)
 */
export const IRON_FIST_IRON_FIST_IDENTITY: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const IRON_FIST_IRON_FIST_IDENTITY_SKIPPED: Readonly<Record<string, string>> = {
  "64001a.martial-arts-master": "not scripted yet: chi counters placed after playing a card",
  "64001a.iron-fist-forced-response": "not scripted yet: chi counter removal and healing after the player phase",
  "64001b.danny-rand-constant": "not scripted yet: Technique cards lose temporary",
  "64001b.meditation": "not scripted yet: Meditation search for a Technique card",
};
