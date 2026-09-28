import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
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
 * Every Sinister Motives box (`sm`) ability scripted directly (docs/phase7-wave5.md). Ghost-Spider and Spider-Man
 * (Miles Morales) are started (`ghost-spider/index.ts`, `spider-man-morales/index.ts`), and so is the box's first
 * scenario, Sandman (`sandman/index.ts`). **Adding the box's other four scenarios (Venom, Mysterio, The Sinister
 * Six, Venom Goblin) or its modular sets is one import + one spread line here** — one subfolder per hero/scenario
 * group, mirroring `./sandman/`'s shape:
 *
 * ```ts
 * import { VENOM_ABILITIES } from "./venom/index.js";
 * // …
 * export const SM_ABILITIES: AbilityRegistry = mergeRegistries(
 *   GHOST_SPIDER_ABILITIES,
 *   SPIDER_MAN_MORALES_ABILITIES,
 *   SANDMAN_ABILITIES,
 *   VENOM_ABILITIES,
 * );
 * ```
 */
export const SM_ABILITIES: AbilityRegistry = mergeRegistries(
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
);
