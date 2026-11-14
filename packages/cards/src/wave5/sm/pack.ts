import { SM_CARDS, SM_ENCOUNTER_SETS, SM_PACK, SM_SCENARIOS, SM_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { SM_BASIC_CARDS } from "./basic-cards.js";
import { SM_CAMPAIGN_ENCOUNTER } from "./campaign/encounter.js";
import { SHIELD_TECH_CAMPAIGN_CARDS } from "./campaign/shield-tech.js";
import { GHOST_SPIDER_ABILITIES } from "./ghost-spider/index.js";
import { SM_MODULAR_ABILITIES } from "./modulars/index.js";
import { MYSTERIO_ABILITIES } from "./mysterio/index.js";
import { SANDMAN_ABILITIES } from "./sandman/index.js";
import { SINISTER_SIX_ABILITIES } from "./sinister-six/index.js";
import { SPIDER_MAN_MORALES_ABILITIES } from "./spider-man-morales/index.js";
import { VENOM_ABILITIES } from "./venom/index.js";
import { VENOM_GOBLIN_ABILITIES } from "./venom-goblin/index.js";

/**
 * The `sm` product as a built-in pack: its cards and every script they need.
 *
 * One subfolder per hero or scenario group (`ghost-spider/`, `spider-man-morales/`, `sandman/`, `venom/`,
 * `mysterio/`, `sinister-six/`, `venom-goblin/`), then the box's modular sets (`modulars/`), its campaign cards
 * (`campaign/`) and the basic player cards (`basic-cards.ts`). See docs/phase7-wave5.md.
 */
export const SM_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "sm", kind: "campaign", name: SM_PACK.name, product: SM_PACK },
  cards: SM_CARDS,
  encounterSets: SM_ENCOUNTER_SETS,
  scenarios: SM_SCENARIOS,
  decks: SM_STARTER_DECKS,
  abilities: mergeRegistries(
    GHOST_SPIDER_ABILITIES,
    SPIDER_MAN_MORALES_ABILITIES,
    SANDMAN_ABILITIES,
    VENOM_ABILITIES,
    MYSTERIO_ABILITIES,
    SINISTER_SIX_ABILITIES,
    VENOM_GOBLIN_ABILITIES,
    SM_MODULAR_ABILITIES,
    SHIELD_TECH_CAMPAIGN_CARDS,
    SM_CAMPAIGN_ENCOUNTER,
    SM_BASIC_CARDS,
  ),
});
