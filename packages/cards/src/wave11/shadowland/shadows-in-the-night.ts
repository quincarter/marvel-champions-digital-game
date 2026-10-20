import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Shadowland (shadows in the night; docs/phase7-shadowland.md). The pack is mid-transcription (40 of 70 cards), so this module is a scaffold.
 *
 * Cards (6):
 * - 65003a The Streets Below (environment)
 * - 65004a The Streets Below (environment)
 * - 65005 Black Tarantula (minion)
 * - 65008 Strategic Positioning (side_scheme)
 * - 65010 Chaos in Hell's Kitchen (treachery)
 * - 65011 Moonlit Silhouette (treachery)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const SHADOWLAND_SHADOWS_IN_THE_NIGHT: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SHADOWLAND_SHADOWS_IN_THE_NIGHT_SKIPPED: Readonly<Record<string, string>> = {
  "65003a.the-streets-below-constant": "Shadowland transcription/scripting in progress",
  "65003a.the-streets-below-constant-2": "Shadowland transcription/scripting in progress",
  "65003a.the-streets-below-constant-3": "Shadowland transcription/scripting in progress",
  "65003b.atop-the-tenshu-constant": "Shadowland transcription/scripting in progress",
  "65003b.atop-the-tenshu-constant-2": "Shadowland transcription/scripting in progress",
  "65003b.atop-the-tenshu-constant-3": "Shadowland transcription/scripting in progress",
  "65004a.the-streets-below-constant": "Shadowland transcription/scripting in progress",
  "65004a.the-streets-below-constant-2": "Shadowland transcription/scripting in progress",
  "65004a.the-streets-below-constant-3": "Shadowland transcription/scripting in progress",
  "65004a.the-streets-below-constant-4": "Shadowland transcription/scripting in progress",
  "65004b.atop-the-tenshu-constant": "Shadowland transcription/scripting in progress",
  "65004b.atop-the-tenshu-constant-2": "Shadowland transcription/scripting in progress",
  "65004b.atop-the-tenshu-constant-3": "Shadowland transcription/scripting in progress",
  "65004b.atop-the-tenshu-constant-4": "Shadowland transcription/scripting in progress",
  "65005.when-revealed": "Shadowland transcription/scripting in progress",
  "65008.strategic-positioning-constant": "Shadowland transcription/scripting in progress",
  "65008.strategic-positioning-constant-2": "Shadowland transcription/scripting in progress",
  "65010.when-revealed": "Shadowland transcription/scripting in progress",
  "65010.boost": "Shadowland transcription/scripting in progress",
  "65011.when-revealed-alter-ego": "Shadowland transcription/scripting in progress",
  "65011.when-revealed-hero": "Shadowland transcription/scripting in progress",
};
