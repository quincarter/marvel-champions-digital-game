import type { AbilityRegistry } from "@mc/engine";

/**
 * Wave 11 scripting module `jj/basic` (docs/phase7-wave11-hero-packs.md H8.4).
 *
 * Cards (5):
 * - 61025 Hellcat (ally)
 * - 61026 Joys of Life (event)
 * - 61027 Unbreakable Bond (event)
 * - 61028 Second Chance (player_side_scheme)
 * - 61029 Defend Our City (player_side_scheme)
 *
 * Scaffold (HS0): the registry is empty and every ref is in `JJ_BASIC_SKIPPED`. The scripting
 * task for this module fills the registry, deletes its own `_SKIPPED` lines and names every id it registers in
 * `basic.test.ts`.
 */
export const JJ_BASIC: AbilityRegistry = {};

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const JJ_BASIC_SKIPPED: Readonly<Record<string, string>> = {
  "61025.hellcat-constant": "wave 11 scripting in progress: jj/basic",
  "61026.joys-of-life-action": "wave 11 scripting in progress: jj/basic",
  "61027.unbreakable-bond-action": "wave 11 scripting in progress: jj/basic",
  "61028.when-defeated": "wave 11 scripting in progress: jj/basic",
  "61029.when-defeated": "wave 11 scripting in progress: jj/basic",
};
