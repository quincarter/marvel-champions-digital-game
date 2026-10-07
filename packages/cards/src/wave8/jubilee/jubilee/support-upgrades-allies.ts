import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Jubilee signature supports, upgrades, allies and resources. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (7):
 * - 47002 Wolverine (ally)
 * - 47003 Shopping Spree (player_side_scheme)
 * - 47004 Jubilee's Coat (upgrade)
 * - 47005 Jubilee's Sunglasses (upgrade)
 * - 47010a Plasmoid Energy (resource)
 * - 47010b Plasmoid Energy (resource)
 * - 47010c Plasmoid Energy (resource)
 */
export const JUBILEE_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({});
