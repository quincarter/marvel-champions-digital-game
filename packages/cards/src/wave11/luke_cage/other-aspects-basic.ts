import type { AbilityRegistry } from "@mc/engine";
import { JJ_BASIC } from "../jj/basic.js";

/**
 * Wave 11 scripting module `luke_cage/other-aspects-basic` (docs/phase7-wave11-hero-packs.md H8.4).
 *
 * Cards (12):
 * - 62020 Hulk (ally)
 * - 62021 She-Hulk (ally)
 * - 62022 Dynamic Duo (event)
 * - 62023 Power Man and Iron Fist (event)
 * - 62024 Unbreakable Bond (event)
 * - 62025 Energy (resource)
 * - 62026 Genius (resource)
 * - 62027 Strength (resource)
 * - 62034 Size Advantage (event)
 * - 62035 Observe (event)
 * - 62036 Toughen Up (upgrade)
 * - 62037 Black Belt (upgrade)
 *
 * Prints no ability, nothing to script: 62025 Energy, 62026 Genius, 62027 Strength.
 *
 * Scaffold (HS0): the registry is empty and every ref is in `LUKE_CAGE_OTHER_ASPECTS_BASIC_SKIPPED`. The scripting
 * task for this module fills the registry, deletes its own `_SKIPPED` lines and names every id it registers in
 * `other-aspects-basic.test.ts`.
 */
export const LUKE_CAGE_OTHER_ASPECTS_BASIC: AbilityRegistry = {
  "62024.unbreakable-bond-action": JJ_BASIC["61027.unbreakable-bond-action"]!,
};

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const LUKE_CAGE_OTHER_ASPECTS_BASIC_SKIPPED: Readonly<Record<string, string>> = {
  "62020.hulk-constant": "wave 11 scripting in progress: luke_cage/other-aspects-basic",
  "62020.hulk-response": "wave 11 scripting in progress: luke_cage/other-aspects-basic",
  "62021.she-hulk-response": "wave 11 scripting in progress: luke_cage/other-aspects-basic",
  "62022.dynamic-duo-action": "wave 11 scripting in progress: luke_cage/other-aspects-basic",
  "62023.power-man-and-iron-fist-action": "wave 11 scripting in progress: luke_cage/other-aspects-basic",
  "62034.size-advantage-action": "wave 11 scripting in progress: luke_cage/other-aspects-basic",
  "62035.observe-action": "wave 11 scripting in progress: luke_cage/other-aspects-basic",
  "62036.toughen-up-response": "wave 11 scripting in progress: luke_cage/other-aspects-basic",
  "62037.black-belt-constant": "wave 11 scripting in progress: luke_cage/other-aspects-basic",
  "62037.black-belt-constant-2": "wave 11 scripting in progress: luke_cage/other-aspects-basic",
};
