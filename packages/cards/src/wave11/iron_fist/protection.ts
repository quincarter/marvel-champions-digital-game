import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";
import { WAVE10_ABILITIES } from "../../wave10/index.js";

/**
 * Wave 11 scripting module `iron_fist/protection` (docs/phase7-elektra-iron-fist.md). Scaffold: a registry holding only the reprint aliases
 * (an empty one when there are none) with every other ref skipped, so scripting it is editing this file and its test.
 *
 * Cards (8):
 * - 64013 Helpful Bystander (ally)
 * - 64014 Iron Fist (ally)
 * - 64015 Defiance (event)
 * - 64016 Demoralize (event)
 * - 64017 The Night Nurse (support)
 * - 64018 Redirection Mastery (upgrade)
 * - 64019 No Time to Bleed (upgrade)
 * - 64020 Tonfa (upgrade)
 *
 * Reprints, aliased to the original card's script: 64015, 64017.
 */
export const IRON_FIST_PROTECTION: AbilityRegistry = defineAbilities({
  "64015.defiance-interrupt": WAVE10_ABILITIES["26018.defiance-interrupt"]!,
  "64017.the-night-nurse-action": WAVE10_ABILITIES["09019.the-night-nurse-action"]!,
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const IRON_FIST_PROTECTION_SKIPPED: Readonly<Record<string, string>> = {
  "64013.helpful-bystander-constant": "not scripted yet: Helpful Bystander constant",
  "64013.helpful-bystander-forced-interrupt": "not scripted yet: Helpful Bystander forced interrupt",
  "64014.iron-fist-response": "not scripted yet: Iron Fist response",
  "64016.demoralize-action": "not scripted yet: Demoralize action",
  "64018.redirection-mastery-response": "not scripted yet: Redirection Mastery response",
  "64019.no-time-to-bleed-response": "not scripted yet: No Time to Bleed response",
  "64020.tonfa-interrupt": "not scripted yet: Tonfa interrupt",
};
