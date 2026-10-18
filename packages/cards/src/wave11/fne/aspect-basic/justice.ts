import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";
import { WAVE10_ABILITIES } from "../../../wave10/index.js";

/**
 * Wave 11 scripting module `fne/aspect-basic/justice` (docs/phase7-wave11.md §8.4).
 *
 * Cards (10):
 * - 60019 Blindspot (ally)
 * - 60020 Cloak (ally)
 * - 60021 Dagger (ally)
 * - 60022 Ghost Rider (ally)
 * - 60023 Know Your Enemy (event)
 * - 60024 De-escalation (player_side_scheme)
 * - 60025 Chance Encounter (upgrade)
 * - 60026 Legal Trouble (upgrade)
 * - 60027 Move in Shadow (upgrade)
 * - 60028 Stealth Training (upgrade)
 *
 * Reprints, aliased to the original script: 60025.chance-encounter-interrupt. The test checks the printed text matches.
 *
 * Scaffold: only the reprint aliases are registered and every other ref is in `FNE_ASPECT_BASIC_JUSTICE_SKIPPED`.
 * The scripting
 * task for this module fills the registry, deletes its own `_SKIPPED` lines and names every id it registers in
 * `justice.test.ts`.
 */
export const FNE_ASPECT_BASIC_JUSTICE: AbilityRegistry = defineAbilities({
  "60025.chance-encounter-interrupt": WAVE10_ABILITIES["26034.chance-encounter-interrupt"]!,
});

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const FNE_ASPECT_BASIC_JUSTICE_SKIPPED: Readonly<Record<string, string>> = {
  "60019.blindspot-response": "wave 11 scripting in progress: fne/aspect-basic/justice",
  "60020.cloak-action": "wave 11 scripting in progress: fne/aspect-basic/justice",
  "60021.dagger-constant": "wave 11 scripting in progress: fne/aspect-basic/justice",
  "60021.dagger-constant-2": "wave 11 scripting in progress: fne/aspect-basic/justice",
  "60022.ghost-rider-interrupt": "wave 11 scripting in progress: fne/aspect-basic/justice",
  "60023.know-your-enemy-action": "wave 11 scripting in progress: fne/aspect-basic/justice",
  "60024.when-defeated": "wave 11 scripting in progress: fne/aspect-basic/justice",
  "60026.legal-trouble-constant": "wave 11 scripting in progress: fne/aspect-basic/justice",
  "60027.move-in-shadow-response": "wave 11 scripting in progress: fne/aspect-basic/justice",
  "60028.stealth-training-response": "wave 11 scripting in progress: fne/aspect-basic/justice",
};
