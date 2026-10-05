import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/** Angel identity (both forms, 42001 onward). Not scripted yet: an empty registry for the scripting agent of this group to fill. */
export const ANGEL_IDENTITY: AbilityRegistry = defineAbilities({});
