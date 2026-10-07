import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Scenario or modular encounter set `apocalypse`. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (12):
 * - 45101a Apocalypse (villain)
 * - 45103a The Age of Apocalypse (main_scheme)
 * - 45104a Heart of the Empire (side_scheme)
 * - 45104b The Towering Citadel (side_scheme)
 * - 45105a The Tyrant's Throne (side_scheme)
 * - 45105b No Longer Worthy (attachment)
 * - 45106 Cyberpathy (attachment)
 * - 45107 Biomorphing (attachment)
 * - 45108 Molecular Control (attachment)
 * - 45109 The Fittest (attachment)
 * - 45110 Wolf Among Sheep (treachery)
 * - 45111 The Apocalypse Solution (side_scheme)
 */
export const APOCALYPSE: AbilityRegistry = defineAbilities({});
