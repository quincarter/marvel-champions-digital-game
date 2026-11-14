import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";
import { LUKE_CAGE_OTHER_ASPECTS_BASIC } from "../luke_cage/other-aspects-basic.js";

/**
 * Wave 11 scripting module `iron_fist/basic` (docs/phase7-elektra-iron-fist.md). Scaffold: a registry holding only the reprint aliases
 * (an empty one when there are none) with every other ref skipped, so scripting it is editing this file and its test.
 *
 * Cards (6):
 * - 64021 Colleen Wing (ally)
 * - 64022 Luke Cage (ally)
 * - 64023 Punch, Reverse Punch (event)
 * - 64024 Power Man and Iron Fist (event)
 * - 64025 Thunder Dojo (support)
 * - 64033 The Defenders (resource)
 *
 * Reprints, aliased to the original card's script: 64024.
 */
export const IRON_FIST_BASIC: AbilityRegistry = defineAbilities({
  "64024.power-man-and-iron-fist-action": LUKE_CAGE_OTHER_ASPECTS_BASIC["62023.power-man-and-iron-fist-action"]!,
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const IRON_FIST_BASIC_SKIPPED: Readonly<Record<string, string>> = {
  "64021.colleen-wing-constant": "not scripted yet: Colleen Wing constant",
  "64022.luke-cage-constant": "not scripted yet: Luke Cage ally toughness and constant",
  "64023.punch-reverse-punch-action": "not scripted yet: Punch, Reverse Punch action",
  "64025.thunder-dojo-action": "not scripted yet: Thunder Dojo action",
  "64033.the-defenders-constant": "not scripted yet: The Defenders constant",
};
