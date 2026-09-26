import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { GHOST_SPIDER_ABILITIES } from "./ghost-spider/index.js";

/**
 * Every Sinister Motives box (`sm`) ability scripted directly (docs/phase7-wave5.md). Ghost-Spider is started
 * (`ghost-spider/index.ts`). **Adding Spider-Man (Miles Morales), or the box's scenarios/modulars, is one
 * import + one spread line here** — one subfolder per hero/scenario group, mirroring `./ghost-spider/`'s shape:
 *
 * ```ts
 * import { SPIDER_MAN_MORALES_ABILITIES } from "./spider-man-morales/index.js";
 * // …
 * export const SM_ABILITIES: AbilityRegistry = mergeRegistries(
 *   GHOST_SPIDER_ABILITIES,
 *   SPIDER_MAN_MORALES_ABILITIES,
 * );
 * ```
 */
export const SM_ABILITIES: AbilityRegistry = mergeRegistries(GHOST_SPIDER_ABILITIES);
