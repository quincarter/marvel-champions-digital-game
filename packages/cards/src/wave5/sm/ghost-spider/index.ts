import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { GHOST_SPIDER_IDENTITY } from "./identity.js";

/**
 * Every Ghost-Spider (`sm` 27001a–27029) ability scripted directly (docs/phase7-wave5.md). Only her identity
 * (27001a/b) is scripted so far. **Adding the rest is one import + one spread line here**, mirroring
 * `../../wave4/vision/index.ts`'s shape:
 *
 * ```ts
 * import { GHOST_SPIDER_EVENTS } from "./events.js";
 * import { GHOST_SPIDER_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
 * import { GHOST_SPIDER_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
 * // …
 * export const GHOST_SPIDER_ABILITIES: AbilityRegistry = mergeRegistries(
 *   GHOST_SPIDER_IDENTITY,
 *   GHOST_SPIDER_EVENTS,
 *   GHOST_SPIDER_SUPPORT_UPGRADES_ALLIES,
 *   GHOST_SPIDER_OBLIGATION_NEMESIS,
 * );
 * ```
 */
export const GHOST_SPIDER_ABILITIES: AbilityRegistry = mergeRegistries(GHOST_SPIDER_IDENTITY);
