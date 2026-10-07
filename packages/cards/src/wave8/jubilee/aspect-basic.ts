import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Jubilee pack aspect and basic player cards. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (14):
 * - 47011 Chamber (ally)
 * - 47012 Husk (ally)
 * - 47013 Disguise (upgrade)
 * - 47014 Waylay (event)
 * - 47015 Three Steps Ahead (event)
 * - 47016 Generation X (player_side_scheme)
 * - 47017 The Power of Justice (resource)
 * - 47018 Synch (ally)
 * - 47019 Cell Phone (upgrade)
 * - 47020 X-Gene (upgrade)
 * - 47021 Multitalented (event)
 * - 47022 Unlikely Duo (event)
 * - 47028 Mutant Mayhem (event)
 * - 47029 Serve and Protect (event)
 */
export const JUBILEE_ASPECT_BASIC: AbilityRegistry = defineAbilities({});
