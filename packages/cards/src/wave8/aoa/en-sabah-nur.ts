import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Scenario or modular encounter set `en_sabah_nur`. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (9):
 * - 45147a En Sabah Nur's Pyramid (main_scheme)
 * - 45149 Staggering Strength (attachment)
 * - 45150 Biomorphic Blast (treachery)
 * - 45151 Technological Interface (treachery)
 * - 45152 Giant-Sized Despot (treachery)
 * - 45153 Source of Power (side_scheme)
 * - 45154 Plugged In (side_scheme)
 * - 45155 Giant Growth (side_scheme)
 * - 45184a Apocalypse (villain)
 */
export const EN_SABAH_NUR: AbilityRegistry = defineAbilities({});
