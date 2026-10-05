import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/** X-23 signature supports, upgrades, allies and resources (43001 onward). Not scripted yet: an empty registry for the scripting agent of this group to fill. */
export const X23_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({});
