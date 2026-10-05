import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/** Cable identity (both forms, 40001-40036). Not scripted yet: an empty registry for the scripting agent of this group to fill. */
export const CABLE_IDENTITY: AbilityRegistry = defineAbilities({});
