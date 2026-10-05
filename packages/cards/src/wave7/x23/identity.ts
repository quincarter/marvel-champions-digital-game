import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/** X-23 identity (both forms, 43001 onward). Not scripted yet: an empty registry for the scripting agent of this group to fill. */
export const X23_IDENTITY: AbilityRegistry = defineAbilities({});
