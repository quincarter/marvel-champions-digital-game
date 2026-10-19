import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * The Drive modular set (docs/phase7-wave11-scenarios.md section S6).
 *
 * Cards (5):
 * - 60186 Sports Car (attachment)
 * - 60187 Motorcycle (attachment)
 * - 60188 Utility Van (attachment)
 * - 60189 Traffic Jam (side_scheme)
 * - 60190 Carjacking (treachery)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const FNE_MODULAR_DRIVE: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_MODULAR_DRIVE_SKIPPED: Readonly<Record<string, string>> = {
  "60186.sports-car-constant": "wave 11 scripting in progress: fne/modular/drive",
  "60186.sports-car-forced-interrupt": "wave 11 scripting in progress: fne/modular/drive",
  "60187.motorcycle-constant": "wave 11 scripting in progress: fne/modular/drive",
  "60187.motorcycle-forced-interrupt": "wave 11 scripting in progress: fne/modular/drive",
  "60188.utility-van-constant": "wave 11 scripting in progress: fne/modular/drive",
  "60188.utility-van-forced-interrupt": "wave 11 scripting in progress: fne/modular/drive",
  "60189.traffic-jam-forced-interrupt": "wave 11 scripting in progress: fne/modular/drive",
  "60190.when-revealed": "wave 11 scripting in progress: fne/modular/drive",
};
