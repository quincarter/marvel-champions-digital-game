import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";
import { WAVE10_ABILITIES } from "../../../wave10/index.js";

/**
 * Wave 11 scripting module `fne/aspect-basic/basic` (docs/phase7-wave11.md §8.4).
 *
 * Cards (8):
 * - 60029 Stick (support)
 * - 60030 Contingency Planning (upgrade)
 * - 60031 Dance with the Devil (upgrade)
 * - 60055 See No Evil, Hear No Evil (event)
 * - 60056 Superpower Training (player_side_scheme)
 * - 60057 Energy (resource)
 * - 60058 Genius (resource)
 * - 60059 Strength (resource)
 *
 * Prints no ability, nothing to script: 60057 Energy, 60058 Genius, 60059 Strength.
 *
 * Reprints, aliased to the original script: 60056.when-defeated. The test checks the printed text matches.
 *
 * Scaffold: only the reprint aliases are registered and every other ref is in `FNE_ASPECT_BASIC_BASIC_SKIPPED`. The
 * scripting
 * task for this module fills the registry, deletes its own `_SKIPPED` lines and names every id it registers in
 * `basic.test.ts`.
 */
export const FNE_ASPECT_BASIC_BASIC: AbilityRegistry = defineAbilities({
  "60056.when-defeated": WAVE10_ABILITIES["40059.when-defeated"]!,
});

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const FNE_ASPECT_BASIC_BASIC_SKIPPED: Readonly<Record<string, string>> = {
  "60029.stick-interrupt": "wave 11 scripting in progress: fne/aspect-basic/basic",
  "60030.contingency-planning-constant": "wave 11 scripting in progress: fne/aspect-basic/basic",
  "60030.contingency-planning-action": "wave 11 scripting in progress: fne/aspect-basic/basic",
  "60031.dance-with-the-devil-action": "wave 11 scripting in progress: fne/aspect-basic/basic",
  "60055.see-no-evil-hear-no-evil-constant": "wave 11 scripting in progress: fne/aspect-basic/basic",
};
