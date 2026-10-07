import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Iceman pack aspect and basic player cards. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (12):
 * - 46012 Shark-Girl (ally)
 * - 46013 Glob (ally)
 * - 46014 Suppressing Fire (upgrade)
 * - 46015 Surprise Move (event)
 * - 46016 Take That! (event)
 * - 46017 Looking for Trouble (event)
 * - 46018 Keep Up the Pressure (player_side_scheme)
 * - 46019 Shadowcat (ally)
 * - 46020 Beak (ally)
 * - 46021 Team-Building Exercise (support)
 * - 46022 Recuperation (event)
 * - 46023 The Power in All of Us (resource)
 */
export const ICEMAN_ASPECT_BASIC: AbilityRegistry = defineAbilities({});
