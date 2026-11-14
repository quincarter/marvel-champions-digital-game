import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 11 scripting module `elektra/elektra/events` (docs/phase7-elektra-iron-fist.md). Scaffold: a registry holding only the reprint aliases
 * (an empty one when there are none) with every other ref skipped, so scripting it is editing this file and its test.
 *
 * Cards (4):
 * - 63006 Acrobatic Prowess (event)
 * - 63007 Killer Blow (event)
 * - 63008 Move Unseen (event)
 * - 63009 Sai Strike (event)
 */
export const ELEKTRA_ELEKTRA_EVENTS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const ELEKTRA_ELEKTRA_EVENTS_SKIPPED: Readonly<Record<string, string>> = {
  "63006.acrobatic-prowess-action":
    "not scripted yet: ready Elektra and give her a facedown boost card, which needs the Villainous boost primitive",
  "63007.killer-blow-action":
    "needs engine primitive: the Ninja deck (a separate encounter-family deck shuffled into the encounter deck)",
  "63008.move-unseen-action":
    "needs engine primitive: the Ninja deck (a separate encounter-family deck shuffled into the encounter deck)",
  "63009.sai-strike-action":
    "needs engine primitive: the Ninja deck (a separate encounter-family deck shuffled into the encounter deck)",
};
