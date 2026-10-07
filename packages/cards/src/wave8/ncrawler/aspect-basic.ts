import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Nightcrawler pack aspect and basic player cards. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (16):
 * - 48012 Rogue (ally)
 * - 48013 Northstar (ally)
 * - 48014 Change of Fortune (upgrade)
 * - 48015 Under Control (upgrade)
 * - 48016 "Come Get Me, Bub!" (event)
 * - 48017 Powerful Punch (event)
 * - 48018 Riposte (event)
 * - 48019 The Power of Protection (resource)
 * - 48020 Astonishing X-Men (player_side_scheme)
 * - 48021 Gambit (ally)
 * - 48022 Moira MacTaggert (support)
 * - 48023 Energy (resource)
 * - 48024 Genius (resource)
 * - 48025 Strength (resource)
 * - 48031 Combine Forces (event)
 * - 48032 Gunboat Diplomacy (event)
 */
export const NCRAWLER_ASPECT_BASIC: AbilityRegistry = defineAbilities({});
