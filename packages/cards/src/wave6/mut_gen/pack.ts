import {
  MUT_GEN_CARDS,
  MUT_GEN_ENCOUNTER_SETS,
  MUT_GEN_PACK,
  MUT_GEN_SCENARIOS,
  MUT_GEN_STARTER_DECKS,
} from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { ACOLYTES_ABILITIES } from "./acolytes.js";
import { BROTHERHOOD_ABILITIES } from "./brotherhood.js";
import { MUT_GEN_CAMPAIGN_CARDS } from "./campaign-cards.js";
import { COLOSSUS_ABILITIES } from "./colossus/index.js";
import { FUTURE_PAST_ABILITIES } from "./future-past.js";
import { MAGNETO_ABILITIES } from "./magneto.js";
import { MANSION_ATTACK_ABILITIES } from "./mansion-attack.js";
import { MASTER_MOLD_ABILITIES } from "./master-mold.js";
import { MYSTIQUE_ABILITIES } from "./mystique.js";
import { MUT_GEN_PRECON_PLAYER_CARDS } from "./precon-player-cards.js";
import { PROJECT_WIDEAWAKE_ABILITIES } from "./project-wideawake.js";
import { MUT_GEN_ROLE_UPGRADES } from "./role-upgrades.js";
import { SABRETOOTH_ABILITIES } from "./sabretooth.js";
import { SENTINELS_ABILITIES } from "./sentinels.js";
import { SHADOWCAT_ABILITIES } from "./shadowcat/index.js";
import { ZERO_TOLERANCE_ABILITIES } from "./zero-tolerance.js";

/**
 * The `mut_gen` product (Mutant Genesis, MC32) as a built-in pack: its cards and every script they need, one module
 * per scenario or encounter set (Project Wideawake, Sabretooth, Master Mold, Mansion Attack, Brotherhood, Magneto,
 * Acolytes, Mystique, Sentinels, Zero Tolerance, Future Past), the Colossus (`colossus/`) and Shadowcat
 * (`shadowcat/`) hero folders, the precons' player cards, the campaign cards and the campaign role upgrades.
 */
export const MUT_GEN_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "mut_gen", kind: "campaign", name: MUT_GEN_PACK.name, product: MUT_GEN_PACK },
  cards: MUT_GEN_CARDS,
  encounterSets: MUT_GEN_ENCOUNTER_SETS,
  scenarios: MUT_GEN_SCENARIOS,
  decks: MUT_GEN_STARTER_DECKS,
  abilities: mergeRegistries(
    PROJECT_WIDEAWAKE_ABILITIES,
    SABRETOOTH_ABILITIES,
    MASTER_MOLD_ABILITIES,
    MANSION_ATTACK_ABILITIES,
    BROTHERHOOD_ABILITIES,
    MAGNETO_ABILITIES,
    ACOLYTES_ABILITIES,
    MYSTIQUE_ABILITIES,
    COLOSSUS_ABILITIES,
    SENTINELS_ABILITIES,
    SHADOWCAT_ABILITIES,
    ZERO_TOLERANCE_ABILITIES,
    FUTURE_PAST_ABILITIES,
    MUT_GEN_PRECON_PLAYER_CARDS,
    MUT_GEN_CAMPAIGN_CARDS,
    MUT_GEN_ROLE_UPGRADES,
  ),
});
