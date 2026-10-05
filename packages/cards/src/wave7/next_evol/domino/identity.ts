import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/** Domino identity (both forms, 40037-40069). Not scripted yet: an empty registry for the scripting agent of this group to fill. */
export const DOMINO_IDENTITY: AbilityRegistry = defineAbilities({});
