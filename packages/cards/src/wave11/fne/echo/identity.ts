import type { AbilityRegistry } from "@mc/engine";

/**
 * Wave 11 scripting module `fne/echo/identity` (docs/phase7-wave11.md §8.4).
 *
 * Cards (1):
 * - 60037a Echo (hero_identity)
 *
 * Scaffold: the registry is empty and every other ref is in `FNE_ECHO_IDENTITY_SKIPPED`. The scripting
 * task for this module fills the registry, deletes its own `_SKIPPED` lines and names every id it registers in
 * `identity.test.ts`.
 */
export const FNE_ECHO_IDENTITY: AbilityRegistry = {};

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const FNE_ECHO_IDENTITY_SKIPPED: Readonly<Record<string, string>> = {
  "60037a.watch-and-learn": "wave 11 scripting in progress: fne/echo/identity",
  "60037b.practice-makes-perfect": "wave 11 scripting in progress: fne/echo/identity",
};
