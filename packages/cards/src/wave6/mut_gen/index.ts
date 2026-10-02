import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { BROTHERHOOD_ABILITIES } from "./brotherhood.js";
import { MANSION_ATTACK_ABILITIES } from "./mansion-attack.js";
import { MASTER_MOLD_ABILITIES } from "./master-mold.js";
import { PROJECT_WIDEAWAKE_ABILITIES } from "./project-wideawake.js";
import { SABRETOOTH_ABILITIES } from "./sabretooth.js";

/**
 * The Mutant Genesis box's ability scripts (`mut_gen`, MC32), one module per scenario / encounter set as they are
 * scripted: Project Wideawake's own set (`project-wideawake.ts`), Sabretooth's (`sabretooth.ts`) and Master Mold's
 * (`master-mold.ts`) Mansion Attack's (`mansion-attack.ts`) and the Brotherhood modular set's (`brotherhood.ts`) so far.
 */
export const MUT_GEN_ABILITIES: AbilityRegistry = mergeRegistries(
  PROJECT_WIDEAWAKE_ABILITIES,
  SABRETOOTH_ABILITIES,
  MASTER_MOLD_ABILITIES,
  MANSION_ATTACK_ABILITIES,
  BROTHERHOOD_ABILITIES,
);

export { BROTHERHOOD_ABILITIES } from "./brotherhood.js";
export { MANSION_ATTACK_ABILITIES } from "./mansion-attack.js";
export { MASTER_MOLD_ABILITIES } from "./master-mold.js";
export { PROJECT_WIDEAWAKE_ABILITIES } from "./project-wideawake.js";
export { SABRETOOTH_ABILITIES } from "./sabretooth.js";
