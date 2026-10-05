import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/** Deadpool signature events (44001 onward). Not scripted yet: an empty registry for the scripting agent of this group to fill. */
export const DEADPOOL_EVENTS: AbilityRegistry = defineAbilities({});
