import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";
import { WAVE10_ABILITIES } from "../../../wave10/index.js";

/**
 * Wave 11 scripting module `fne/aspect-basic/protection` (docs/phase7-wave11.md §8.4).
 *
 * Cards (8):
 * - 60038 Innate Reflexes (upgrade)
 * - 60048 Army of One (event)
 * - 60049 Get Their Attention (event)
 * - 60050 In Harm's Way (event)
 * - 60051 Powerful Punch (event)
 * - 60052 The Best Offense... (upgrade)
 * - 60053 Ronin (upgrade)
 * - 60054 Stand Alone (upgrade)
 *
 * Reprints, aliased to the original script: 60051.powerful-punch-constant. The test checks the printed text matches.
 *
 * Scaffold: only the reprint aliases are registered and every other ref is in `FNE_ASPECT_BASIC_PROTECTION_SKIPPED`.
 * The scripting
 * task for this module fills the registry, deletes its own `_SKIPPED` lines and names every id it registers in
 * `protection.test.ts`.
 */
export const FNE_ASPECT_BASIC_PROTECTION: AbilityRegistry = defineAbilities({
  "60051.powerful-punch-constant": WAVE10_ABILITIES["32014.powerful-punch-constant"]!,
});

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const FNE_ASPECT_BASIC_PROTECTION_SKIPPED: Readonly<Record<string, string>> = {
  "60038.innate-reflexes-constant": "wave 11 scripting in progress: fne/aspect-basic/protection",
  "60048.army-of-one-constant": "wave 11 scripting in progress: fne/aspect-basic/protection",
  "60048.army-of-one-action": "wave 11 scripting in progress: fne/aspect-basic/protection",
  "60049.get-their-attention-constant": "wave 11 scripting in progress: fne/aspect-basic/protection",
  "60050.in-harms-way-constant": "wave 11 scripting in progress: fne/aspect-basic/protection",
  "60050.in-harms-way-constant-2": "wave 11 scripting in progress: fne/aspect-basic/protection",
  "60052.the-best-offense-constant": "wave 11 scripting in progress: fne/aspect-basic/protection",
  "60052.the-best-offense-constant-2": "wave 11 scripting in progress: fne/aspect-basic/protection",
  "60053.ronin-constant": "wave 11 scripting in progress: fne/aspect-basic/protection",
  "60054.stand-alone-interrupt": "wave 11 scripting in progress: fne/aspect-basic/protection",
};
