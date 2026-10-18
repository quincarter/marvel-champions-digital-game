import type { AbilityRegistry } from "@mc/engine";

/**
 * Wave 11 scripting module `luke_cage/luke-cage/identity` (docs/phase7-wave11-hero-packs.md H8.4).
 *
 * Cards (1):
 * - 62001a Luke Cage (hero_identity)
 *
 * Scaffold (HS0): the registry is empty and every ref is in `LUKE_CAGE_LUKE_CAGE_IDENTITY_SKIPPED`. The scripting
 * task for this module fills the registry, deletes its own `_SKIPPED` lines and names every id it registers in
 * `identity.test.ts`.
 */
export const LUKE_CAGE_LUKE_CAGE_IDENTITY: AbilityRegistry = {};

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const LUKE_CAGE_LUKE_CAGE_IDENTITY_SKIPPED: Readonly<Record<string, string>> = {
  "62001a.luke-cage-constant": "wave 11 scripting in progress: luke_cage/luke-cage/identity",
  "62001a.luke-cage-forced-response": "wave 11 scripting in progress: luke_cage/luke-cage/identity",
  "62001b.luke-cage-constant": "wave 11 scripting in progress: luke_cage/luke-cage/identity",
  "62001b.luke-cage-action": "wave 11 scripting in progress: luke_cage/luke-cage/identity",
};
