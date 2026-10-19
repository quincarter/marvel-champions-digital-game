import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * The Art Museum Heist scenario (docs/phase7-wave11-scenarios.md section S6).
 *
 * Cards (7):
 * - 60121a Art Museum Heist (main_scheme)
 * - 60122 Impossible Object (attachment)
 * - 60123 Inspiring Pottery (attachment)
 * - 60124 Replica Shield (attachment)
 * - 60125 Stunning Landscape (attachment)
 * - 60126 Art Thief (minion)
 * - 60127 Tug of War (treachery)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const FNE_SCENARIOS_ART_MUSEUM_HEIST: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_SCENARIOS_ART_MUSEUM_HEIST_SKIPPED: Readonly<Record<string, string>> = {
  "60121a.setup": "wave 11 scripting in progress: fne/scenarios/art-museum-heist",
  "60121b.art-museum-heist-constant": "wave 11 scripting in progress: fne/scenarios/art-museum-heist",
  "60121b.art-museum-heist-forced-response": "wave 11 scripting in progress: fne/scenarios/art-museum-heist",
  "60122.impossible-object-forced-response": "wave 11 scripting in progress: fne/scenarios/art-museum-heist",
  "60122.impossible-object-action": "wave 11 scripting in progress: fne/scenarios/art-museum-heist",
  "60123.inspiring-pottery-constant": "wave 11 scripting in progress: fne/scenarios/art-museum-heist",
  "60123.inspiring-pottery-action": "wave 11 scripting in progress: fne/scenarios/art-museum-heist",
  "60124.replica-shield-forced-response": "wave 11 scripting in progress: fne/scenarios/art-museum-heist",
  "60124.replica-shield-action": "wave 11 scripting in progress: fne/scenarios/art-museum-heist",
  "60125.stunning-landscape-forced-response": "wave 11 scripting in progress: fne/scenarios/art-museum-heist",
  "60125.stunning-landscape-action": "wave 11 scripting in progress: fne/scenarios/art-museum-heist",
  "60126.when-revealed": "wave 11 scripting in progress: fne/scenarios/art-museum-heist",
  "60126.boost": "wave 11 scripting in progress: fne/scenarios/art-museum-heist",
  "60127.when-revealed": "wave 11 scripting in progress: fne/scenarios/art-museum-heist",
};
