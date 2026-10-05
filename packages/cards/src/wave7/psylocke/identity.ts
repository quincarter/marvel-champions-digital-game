import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/** Psylocke identity (both forms, 41001 onward). Not scripted yet: an empty registry for the scripting agent of this group to fill. */
export const PSYLOCKE_IDENTITY: AbilityRegistry = defineAbilities({});
