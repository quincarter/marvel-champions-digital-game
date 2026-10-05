import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/** Cable signature events (40001-40036). Not scripted yet: an empty registry for the scripting agent of this group to fill. */
export const CABLE_EVENTS: AbilityRegistry = defineAbilities({});
