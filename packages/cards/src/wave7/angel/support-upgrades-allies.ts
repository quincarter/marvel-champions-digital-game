import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/** Angel signature supports, upgrades, allies and resources (42001 onward). Not scripted yet: an empty registry for the scripting agent of this group to fill. */
export const ANGEL_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({});
