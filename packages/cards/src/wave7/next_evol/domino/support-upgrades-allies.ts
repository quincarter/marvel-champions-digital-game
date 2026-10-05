import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/** Domino signature supports, upgrades, allies and resources (40037-40069). Not scripted yet: an empty registry for the scripting agent of this group to fill. */
export const DOMINO_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({});
