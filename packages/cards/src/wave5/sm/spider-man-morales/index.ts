import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { SPIDER_MAN_MORALES_IDENTITY } from "./identity.js";

/**
 * Every Spider-Man / Miles Morales (`sm` 27030a–27060) ability scripted directly (docs/phase7-wave5.md). Only his
 * identity (27030a/b) is scripted so far. **Adding the rest is one import + one spread line here**, mirroring
 * `../ghost-spider/index.ts`'s shape:
 *
 * ```ts
 * import { SPIDER_MAN_MORALES_EVENTS } from "./events.js";
 * import { SPIDER_MAN_MORALES_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
 * import { SPIDER_MAN_MORALES_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
 * // …
 * export const SPIDER_MAN_MORALES_ABILITIES: AbilityRegistry = mergeRegistries(
 *   SPIDER_MAN_MORALES_IDENTITY,
 *   SPIDER_MAN_MORALES_EVENTS,
 *   SPIDER_MAN_MORALES_SUPPORT_UPGRADES_ALLIES,
 *   SPIDER_MAN_MORALES_OBLIGATION_NEMESIS,
 * );
 * ```
 */
export const SPIDER_MAN_MORALES_ABILITIES: AbilityRegistry = mergeRegistries(SPIDER_MAN_MORALES_IDENTITY);
