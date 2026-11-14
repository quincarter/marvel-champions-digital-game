import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 11 scripting module `iron_fist/protection` (docs/phase7-elektra-iron-fist.md). Scaffold: an empty registry with every ref
 * skipped, so scripting it is editing this file and its test.
 *
 * Cards (5):
 * - 64013 Helpful Bystander (ally)
 * - 64016 Demoralize (event)
 * - 64018 Redirection Mastery (upgrade)
 * - 64019 No Time to Bleed (upgrade)
 * - 64020 Tonfa (upgrade)
 */
export const IRON_FIST_PROTECTION: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const IRON_FIST_PROTECTION_SKIPPED: Readonly<Record<string, string>> = {
  "64013.helpful-bystander-constant": "not scripted yet: Helpful Bystander constant",
  "64013.helpful-bystander-forced-interrupt": "not scripted yet: Helpful Bystander forced interrupt",
  "64016.demoralize-action": "not scripted yet: Demoralize action",
  "64018.redirection-mastery-response": "not scripted yet: Redirection Mastery response",
  "64019.no-time-to-bleed-response": "not scripted yet: No Time to Bleed response",
  "64020.tonfa-interrupt": "not scripted yet: Tonfa interrupt",
};
