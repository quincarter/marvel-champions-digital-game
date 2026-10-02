import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { PROJECT_WIDEAWAKE_ABILITIES } from "./project-wideawake.js";

/**
 * The Mutant Genesis box's ability scripts (`mut_gen`, MC32), one module per scenario / encounter set as they are
 * scripted: Project Wideawake's own set so far (`project-wideawake.ts`).
 */
export const MUT_GEN_ABILITIES: AbilityRegistry = mergeRegistries(PROJECT_WIDEAWAKE_ABILITIES);

export { PROJECT_WIDEAWAKE_ABILITIES } from "./project-wideawake.js";
