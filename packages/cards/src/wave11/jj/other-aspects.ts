import type { AbilityRegistry } from "@mc/engine";

/**
 * Wave 11 scripting module `jj/other-aspects` (docs/phase7-wave11-hero-packs.md H8.4).
 *
 * Cards (6):
 * - 61034 Innate Aggression (upgrade)
 * - 61035 Shakedown (upgrade)
 * - 61037 Innate Inspiration (upgrade)
 * - 61038 Echo (ally)
 * - 61039 Lay Low (player_side_scheme)
 * - 61040 Mitigated Threat (upgrade)
 *
 * Scaffold (HS0): the registry is empty and every ref is in `JJ_OTHER_ASPECTS_SKIPPED`. The scripting
 * task for this module fills the registry, deletes its own `_SKIPPED` lines and names every id it registers in
 * `other-aspects.test.ts`.
 */
export const JJ_OTHER_ASPECTS: AbilityRegistry = {};

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const JJ_OTHER_ASPECTS_SKIPPED: Readonly<Record<string, string>> = {
  "61034.innate-aggression-constant": "wave 11 scripting in progress: jj/other-aspects",
  "61035.shakedown-response": "wave 11 scripting in progress: jj/other-aspects",
  "61037.innate-inspiration-constant": "wave 11 scripting in progress: jj/other-aspects",
  "61038.echo-constant": "wave 11 scripting in progress: jj/other-aspects",
  "61039.when-defeated": "wave 11 scripting in progress: jj/other-aspects",
  "61040.mitigated-threat-constant": "wave 11 scripting in progress: jj/other-aspects",
  "61040.mitigated-threat-forced-response": "wave 11 scripting in progress: jj/other-aspects",
};
