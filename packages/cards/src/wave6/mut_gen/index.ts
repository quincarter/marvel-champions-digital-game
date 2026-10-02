import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { ACOLYTES_ABILITIES } from "./acolytes.js";
import { BROTHERHOOD_ABILITIES } from "./brotherhood.js";
import { COLOSSUS_ABILITIES } from "./colossus/index.js";
import { MAGNETO_ABILITIES } from "./magneto.js";
import { MANSION_ATTACK_ABILITIES } from "./mansion-attack.js";
import { MASTER_MOLD_ABILITIES } from "./master-mold.js";
import { MYSTIQUE_ABILITIES } from "./mystique.js";
import { MUT_GEN_PRECON_PLAYER_CARDS } from "./precon-player-cards.js";
import { PROJECT_WIDEAWAKE_ABILITIES } from "./project-wideawake.js";
import { SABRETOOTH_ABILITIES } from "./sabretooth.js";
import { SHADOWCAT_ABILITIES } from "./shadowcat/index.js";

/**
 * The Mutant Genesis box's ability scripts (`mut_gen`, MC32), one module per scenario / encounter set as they are
 * scripted: Project Wideawake's own set (`project-wideawake.ts`), Sabretooth's (`sabretooth.ts`) and Master Mold's
 * (`master-mold.ts`) Mansion Attack's (`mansion-attack.ts`), the Brotherhood modular set's (`brotherhood.ts`) and the Magneto scenario's own set
 * (`magneto.ts`) the Acolytes modular set (`acolytes.ts`) and the Colossus hero folder (`colossus/`, identity only) so far.
 */
export const MUT_GEN_ABILITIES: AbilityRegistry = mergeRegistries(
  PROJECT_WIDEAWAKE_ABILITIES,
  SABRETOOTH_ABILITIES,
  MASTER_MOLD_ABILITIES,
  MANSION_ATTACK_ABILITIES,
  BROTHERHOOD_ABILITIES,
  MAGNETO_ABILITIES,
  ACOLYTES_ABILITIES,
  MYSTIQUE_ABILITIES,
  COLOSSUS_ABILITIES,
  SHADOWCAT_ABILITIES,
  MUT_GEN_PRECON_PLAYER_CARDS,
);

export { ACOLYTES_ABILITIES } from "./acolytes.js";
export { BROTHERHOOD_ABILITIES } from "./brotherhood.js";
export { COLOSSUS_ABILITIES } from "./colossus/index.js";
export { MAGNETO_ABILITIES } from "./magneto.js";
export { MANSION_ATTACK_ABILITIES } from "./mansion-attack.js";
export { MASTER_MOLD_ABILITIES } from "./master-mold.js";
export { MUT_GEN_PRECON_PLAYER_CARDS } from "./precon-player-cards.js";
export { MYSTIQUE_ABILITIES, MYSTIQUE_SCENARIO_RULES } from "./mystique.js";
export { PROJECT_WIDEAWAKE_ABILITIES } from "./project-wideawake.js";
export { SABRETOOTH_ABILITIES } from "./sabretooth.js";
export { SHADOWCAT_ABILITIES } from "./shadowcat/index.js";
