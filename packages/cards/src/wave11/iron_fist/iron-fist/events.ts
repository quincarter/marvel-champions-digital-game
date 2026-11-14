import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 11 scripting module `iron_fist/iron-fist/events` (docs/phase7-elektra-iron-fist.md). Scaffold: an empty registry with every ref
 * skipped, so scripting it is editing this file and its test.
 *
 * Cards (4):
 * - 64002 Deep Breathing (event)
 * - 64003 Dragon Punch (event)
 * - 64004 Fists of Fury (event)
 * - 64005 The Way of Things (event)
 */
export const IRON_FIST_IRON_FIST_EVENTS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const IRON_FIST_IRON_FIST_EVENTS_SKIPPED: Readonly<Record<string, string>> = {
  "64002.deep-breathing-action": "not scripted yet: Deep Breathing discard-until Iron Fist card",
  "64003.dragon-punch-action": "not scripted yet: Dragon Punch chi counter spending",
  "64004.fists-of-fury-action": "not scripted yet: Fists of Fury three 1-damage attacks",
  "64005.the-way-of-things-action": "not scripted yet: The Way of Things optional chi counter thwart",
};
