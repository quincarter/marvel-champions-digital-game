import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Scenario or modular encounter set `four_horsemen`. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (20):
 * - 45081a War (villain)
 * - 45081b War (villain)
 * - 45082a Famine (villain)
 * - 45082b Famine (villain)
 * - 45083a Pestilence (villain)
 * - 45083b Pestilence (villain)
 * - 45084a Death (villain)
 * - 45084b Death (villain)
 * - 45085a The Horsemen of Apocalypse (main_scheme)
 * - 45086 The Ravages of War (side_scheme)
 * - 45087 A Time of Famine (side_scheme)
 * - 45088 Plague and Pestilence (side_scheme)
 * - 45089 The Specter of Death (side_scheme)
 * - 45090 Golden Horse (attachment)
 * - 45091 Metal Wings (attachment)
 * - 45092 Horseman of War (treachery)
 * - 45093 Horseman of Famine (treachery)
 * - 45094 Horseman of Pestilence (treachery)
 * - 45095 Horseman of Death (treachery)
 * - 45096 Rough Riders (treachery)
 */
export const FOUR_HORSEMEN: AbilityRegistry = defineAbilities({});
