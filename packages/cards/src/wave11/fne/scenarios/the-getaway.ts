import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * The Getaway scenario (docs/phase7-wave11-scenarios.md section S6).
 *
 * Cards (6):
 * - 60128a The Getaway (main_scheme)
 * - 60129a Out Front (attachment)
 * - 60130 Escort Vehicle (minion)
 * - 60131 Jackknifed Tanker Truck (side_scheme)
 * - 60132 Burning Rubber (treachery)
 * - 60133 Pedestrians (treachery)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const FNE_SCENARIOS_THE_GETAWAY: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_SCENARIOS_THE_GETAWAY_SKIPPED: Readonly<Record<string, string>> = {
  "60128a.setup": "wave 11 scripting in progress: fne/scenarios/the-getaway",
  "60128b.the-getaway-forced-interrupt": "wave 11 scripting in progress: fne/scenarios/the-getaway",
  "60128b.the-getaway-constant": "wave 11 scripting in progress: fne/scenarios/the-getaway",
  "60128b.the-getaway-constant-2": "wave 11 scripting in progress: fne/scenarios/the-getaway",
  "60129a.out-front-constant": "wave 11 scripting in progress: fne/scenarios/the-getaway",
  "60129a.out-front-constant-2": "wave 11 scripting in progress: fne/scenarios/the-getaway",
  "60129a.out-front-forced-interrupt": "wave 11 scripting in progress: fne/scenarios/the-getaway",
  "60129b.when-revealed": "wave 11 scripting in progress: fne/scenarios/the-getaway",
  "60130.escort-vehicle-constant": "wave 11 scripting in progress: fne/scenarios/the-getaway",
  "60130.escort-vehicle-constant-2": "wave 11 scripting in progress: fne/scenarios/the-getaway",
  "60130.escort-vehicle-constant-3": "wave 11 scripting in progress: fne/scenarios/the-getaway",
  "60131.jackknifed-tanker-truck-constant": "wave 11 scripting in progress: fne/scenarios/the-getaway",
  "60132.when-revealed": "wave 11 scripting in progress: fne/scenarios/the-getaway",
  "60133.when-revealed": "wave 11 scripting in progress: fne/scenarios/the-getaway",
};
