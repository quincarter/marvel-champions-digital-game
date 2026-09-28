import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { NOVA_IDENTITY } from "./identity.js";

/**
 * Every Nova (`nova` 28001a–28032) ability scripted directly (docs/phase7-wave5.md). Only his identity (28001a/b)
 * is scripted so far. **Adding the rest is one import + one spread line here**, mirroring
 * `../sm/ghost-spider/index.ts`'s shape:
 *
 * ```ts
 * import { NOVA_EVENTS } from "./events.js";
 * import { NOVA_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
 * import { NOVA_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
 * // …
 * export const NOVA_ABILITIES: AbilityRegistry = mergeRegistries(
 *   NOVA_IDENTITY,
 *   NOVA_EVENTS,
 *   NOVA_SUPPORT_UPGRADES_ALLIES,
 *   NOVA_OBLIGATION_NEMESIS,
 * );
 * ```
 */
export const NOVA_ABILITIES: AbilityRegistry = mergeRegistries(NOVA_IDENTITY);
