import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/** Cable signature supports, upgrades, allies and resources (40001-40036). Not scripted yet: an empty registry for the scripting agent of this group to fill. */
export const CABLE_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({});
