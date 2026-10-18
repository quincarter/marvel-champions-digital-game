import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";
import { WAVE10_ABILITIES } from "../../wave10/index.js";

/**
 * Wave 11 scripting module `luke_cage/leadership` (docs/phase7-wave11-hero-packs.md H8.4).
 *
 * Cards (8):
 * - 62012 Iron Fist (ally)
 * - 62013 Misty Knight (ally)
 * - 62014 Valkyrie (ally)
 * - 62015 Take a Stand (event)
 * - 62016 Innovation (resource)
 * - 62017 The Power of Leadership (resource)
 * - 62018 Defensive Formation (support)
 * - 62019 Righteous Purpose (support)
 *
 * Reprints, aliased to the original script (the wave 10 `hercules/basic` precedent): 62016 (21058), 62017 (01072). The
 * test checks the printed text matches.
 *
 * Scaffold (HS0): only the reprint aliases are registered; every other ref is in `LUKE_CAGE_LEADERSHIP_SKIPPED`. The
 * scripting
 * task for this module fills the registry, deletes its own `_SKIPPED` lines and names every id it registers in
 * `leadership.test.ts`.
 */
export const LUKE_CAGE_LEADERSHIP: AbilityRegistry = defineAbilities({
  "62016.innovation-response": WAVE10_ABILITIES["21058.innovation-response"]!,
  "62017.the-power-of-leadership-constant": WAVE10_ABILITIES["01072.the-power-of-leadership-constant"]!,
});

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const LUKE_CAGE_LEADERSHIP_SKIPPED: Readonly<Record<string, string>> = {
  "62012.iron-fist-interrupt": "wave 11 scripting in progress: luke_cage/leadership",
  "62013.misty-knight-constant": "wave 11 scripting in progress: luke_cage/leadership",
  "62014.valkyrie-interrupt": "wave 11 scripting in progress: luke_cage/leadership",
  "62015.take-a-stand-response": "wave 11 scripting in progress: luke_cage/leadership",
  "62018.defensive-formation-action": "wave 11 scripting in progress: luke_cage/leadership",
  "62019.righteous-purpose-constant": "wave 11 scripting in progress: luke_cage/leadership",
};
