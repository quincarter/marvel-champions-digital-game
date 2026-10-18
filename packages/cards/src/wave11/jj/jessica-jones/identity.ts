import type { AbilityRegistry } from "@mc/engine";

/**
 * Wave 11 scripting module `jj/jessica-jones/identity` (docs/phase7-wave11-hero-packs.md H8.4).
 *
 * Cards (2):
 * - 61001a Jessica Jones (hero_identity)
 * - 61002 Alias Investigations (support)
 *
 * Scaffold (HS0): the registry is empty and every ref is in `JJ_JESSICA_JONES_IDENTITY_SKIPPED`. The scripting
 * task for this module fills the registry, deletes its own `_SKIPPED` lines and names every id it registers in
 * `identity.test.ts`.
 */
export const JJ_JESSICA_JONES_IDENTITY: AbilityRegistry = {};

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const JJ_JESSICA_JONES_IDENTITY_SKIPPED: Readonly<Record<string, string>> = {
  "61001a.star-gather-evidence": "wave 11 scripting in progress: jj/jessica-jones/identity",
  "61001b.incognito-mode": "wave 11 scripting in progress: jj/jessica-jones/identity",
  "61001b.setup": "wave 11 scripting in progress: jj/jessica-jones/identity",
  "61002.alias-investigations-response": "wave 11 scripting in progress: jj/jessica-jones/identity",
};
