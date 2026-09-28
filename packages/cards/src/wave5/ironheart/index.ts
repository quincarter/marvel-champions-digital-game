import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { IRONHEART_EVENTS } from "./events.js";
import { IRONHEART_IDENTITY } from "./identity.js";

/**
 * Every Ironheart (`ironheart` 29001a-29040) ability scripted directly (docs/phase7-wave5.md). Her identity
 * (29001a-29003a/29001b-29003b) and signature events (29005-29008, 29017-29019, 29025) are scripted so far.
 * **Adding the rest is one import + one spread line here**, mirroring `../nova/index.ts`'s shape:
 *
 * ```ts
 * import { IRONHEART_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
 * import { IRONHEART_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
 * // …
 * export const IRONHEART_ABILITIES: AbilityRegistry = mergeRegistries(
 *   IRONHEART_IDENTITY,
 *   IRONHEART_EVENTS,
 *   IRONHEART_SUPPORT_UPGRADES_ALLIES,
 *   IRONHEART_OBLIGATION_NEMESIS,
 * );
 * ```
 */
export const IRONHEART_ABILITIES: AbilityRegistry = mergeRegistries(IRONHEART_IDENTITY, IRONHEART_EVENTS);
