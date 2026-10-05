import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/** The Flight set (40151-40154; set aside by Mister Sinister's Setup). Not scripted yet: an empty registry for the scripting agent of this group to fill. */
export const FLIGHT: AbilityRegistry = defineAbilities({});
