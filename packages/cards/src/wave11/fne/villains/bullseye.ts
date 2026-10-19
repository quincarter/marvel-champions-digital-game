import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Bullseye (docs/phase7-wave11-scenarios.md section S6).
 *
 * Cards (9):
 * - 60065 Bullseye (villain)
 * - 60068a Adamantium-Laced Spine (attachment)
 * - 60069 Raise the Stakes (attachment)
 * - 60070 Deadly Sai (attachment)
 * - 60071 Incessant Pursuit (attachment)
 * - 60072 Lady Bullseye (minion)
 * - 60073 Deranged Bloodlust (side_scheme)
 * - 60074 Everything is a Weapon (treachery)
 * - 60075 Unerring Desire (treachery)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const FNE_VILLAINS_BULLSEYE: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_VILLAINS_BULLSEYE_SKIPPED: Readonly<Record<string, string>> = {
  "60065.when-revealed": "wave 11 scripting in progress: fne/villains/bullseye",
  "60065.bullseye-forced-interrupt": "wave 11 scripting in progress: fne/villains/bullseye",
  "60066.when-revealed": "wave 11 scripting in progress: fne/villains/bullseye",
  "60066.bullseye-forced-interrupt": "wave 11 scripting in progress: fne/villains/bullseye",
  "60067.when-revealed": "wave 11 scripting in progress: fne/villains/bullseye",
  "60067.bullseye-forced-interrupt": "wave 11 scripting in progress: fne/villains/bullseye",
  "60068a.adamantium-laced-spine-forced-interrupt": "wave 11 scripting in progress: fne/villains/bullseye",
  "60068b.damaged-spine-forced-response": "wave 11 scripting in progress: fne/villains/bullseye",
  "60069.raise-the-stakes-forced-interrupt": "wave 11 scripting in progress: fne/villains/bullseye",
  "60070.deadly-sai-constant": "wave 11 scripting in progress: fne/villains/bullseye",
  "60070.deadly-sai-response": "wave 11 scripting in progress: fne/villains/bullseye",
  "60071.incessant-pursuit-constant": "wave 11 scripting in progress: fne/villains/bullseye",
  "60071.incessant-pursuit-forced-interrupt": "wave 11 scripting in progress: fne/villains/bullseye",
  "60072.lady-bullseye-forced-interrupt": "wave 11 scripting in progress: fne/villains/bullseye",
  "60073.when-revealed": "wave 11 scripting in progress: fne/villains/bullseye",
  "60073.boost": "wave 11 scripting in progress: fne/villains/bullseye",
  "60074.when-revealed-alter-ego": "wave 11 scripting in progress: fne/villains/bullseye",
  "60074.when-revealed-hero": "wave 11 scripting in progress: fne/villains/bullseye",
  "60074.boost": "wave 11 scripting in progress: fne/villains/bullseye",
  "60075.when-revealed": "wave 11 scripting in progress: fne/villains/bullseye",
  "60075.boost": "wave 11 scripting in progress: fne/villains/bullseye",
};
