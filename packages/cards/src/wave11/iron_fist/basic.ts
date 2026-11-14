import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 11 scripting module `iron_fist/basic` (docs/phase7-elektra-iron-fist.md). Scaffold: an empty registry with every ref
 * skipped, so scripting it is editing this file and its test.
 *
 * Cards (2):
 * - 64022 Luke Cage (ally)
 * - 64024 Power Man and Iron Fist (event)
 */
export const IRON_FIST_BASIC: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const IRON_FIST_BASIC_SKIPPED: Readonly<Record<string, string>> = {
  "64022.luke-cage-constant": "not scripted yet: Luke Cage ally toughness and constant",
  "64024.power-man-and-iron-fist-action": "not scripted yet: Power Man and Iron Fist team-up action",
};
