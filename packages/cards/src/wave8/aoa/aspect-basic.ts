import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Age of Apocalypse pack aspect and basic player cards. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (26):
 * - 45011 Cable (ally)
 * - 45012 X-23 (ally)
 * - 45013 Team Training (support)
 * - 45014 Advanced Suit (upgrade)
 * - 45015 Sidekick (upgrade)
 * - 45016 Side-by-Side (event)
 * - 45017 Suit Up (event)
 * - 45018 Lead from the Front (event)
 * - 45019 The Power of Leadership (resource)
 * - 45020 Legion (ally)
 * - 45021 Marrow (ally)
 * - 45022 Energy (resource)
 * - 45023 Genius (resource)
 * - 45024 Strength (resource)
 * - 45041 Goldballs (ally)
 * - 45042 Tempus (ally)
 * - 45043 Blood Rage (upgrade)
 * - 45044 Test the Defense (upgrade)
 * - 45045 Full-Body Charge (event)
 * - 45046 Clobber (event)
 * - 45047 The Power of Aggression (resource)
 * - 45048 Triage (ally)
 * - 45049 Stepford Cuckoos (support)
 * - 45050 Bloodgem (upgrade)
 * - 45051 Basic Spell (event)
 * - 45052 Spiritual Meditation (event)
 */
export const AOA_ASPECT_BASIC: AbilityRegistry = defineAbilities({});
