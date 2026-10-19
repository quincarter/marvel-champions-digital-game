import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * The Owl modular set (docs/phase7-wave11-scenarios.md section S6).
 *
 * Cards (4):
 * - 60191 Flight Serum (attachment)
 * - 60192 Mister Fish (minion)
 * - 60193 The Owl (minion)
 * - 60194 Swoop Down (treachery)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const FNE_MODULAR_THE_OWL: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_MODULAR_THE_OWL_SKIPPED: Readonly<Record<string, string>> = {
  "60191.flight-serum-constant": "wave 11 scripting in progress: fne/modular/the-owl",
  "60191.flight-serum-constant-2": "wave 11 scripting in progress: fne/modular/the-owl",
  "60191.flight-serum-action": "wave 11 scripting in progress: fne/modular/the-owl",
  "60192.mister-fish-constant": "wave 11 scripting in progress: fne/modular/the-owl",
  "60192.when-revealed": "wave 11 scripting in progress: fne/modular/the-owl",
  "60193.the-owl-constant": "wave 11 scripting in progress: fne/modular/the-owl",
  "60193.boost": "wave 11 scripting in progress: fne/modular/the-owl",
  "60194.when-revealed-alter-ego": "wave 11 scripting in progress: fne/modular/the-owl",
  "60194.when-revealed-hero": "wave 11 scripting in progress: fne/modular/the-owl",
};
