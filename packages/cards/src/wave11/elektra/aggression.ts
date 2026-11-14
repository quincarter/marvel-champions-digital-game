import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 11 scripting module `elektra/aggression` (docs/phase7-elektra-iron-fist.md). Scaffold: an empty registry with every ref
 * skipped, so scripting it is editing this file and its test.
 *
 * Cards (6):
 * - 63015 Shang-Chi (ally)
 * - 63016 Black Cat (ally)
 * - 63017 Combo Move (event)
 * - 63018 Chain Reaction (event)
 * - 63019 Nerve Strike (event)
 * - 63020 Flow of Battle (upgrade)
 */
export const ELEKTRA_AGGRESSION: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const ELEKTRA_AGGRESSION_SKIPPED: Readonly<Record<string, string>> = {
  "63015.shang-chi-constant": "not scripted yet: Shang-Chi ring counters on entering play",
  "63015.shang-chi-action": "not scripted yet: Shang-Chi ring counter action, limit twice per round",
  "63017.combo-move-action": "not scripted yet: Combo Move damage split among enemies",
  "63018.chain-reaction-action": "not scripted yet: Chain Reaction chained damage",
  "63019.nerve-strike-action": "not scripted yet: Nerve Strike stun or confuse choice",
  "63020.flow-of-battle-response": "not scripted yet: Flow of Battle exact-defeat response",
};
