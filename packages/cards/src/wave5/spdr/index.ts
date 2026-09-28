import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { SPDR_IDENTITY } from "./identity.js";
import { SPDR_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";

/**
 * Every SP//dr (`spdr` 31001a-31038) ability scripted directly (docs/phase7-wave5.md). Only her identity
 * (31001a/31001b/31002/31002b) is scripted so far. **Adding the rest is one import + one spread line here**,
 * mirroring `../spiderham/index.ts`'s shape:
 *
 * ```ts
 * import { SPDR_EVENTS } from "./events.js";
 * import { SPDR_ALLIES } from "./allies.js";
 * import { SPDR_SUPPORT_UPGRADES } from "./support-upgrades.js";
 * import { SPDR_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
 * import { SPDR_SINISTER_SYNDICATE } from "./sinister-syndicate.js";
 * // …
 * export const SPDR_ABILITIES: AbilityRegistry = mergeRegistries(
 *   SPDR_IDENTITY,
 *   SPDR_EVENTS,
 *   SPDR_ALLIES,
 *   SPDR_SUPPORT_UPGRADES,
 *   SPDR_OBLIGATION_NEMESIS,
 *   SPDR_SINISTER_SYNDICATE,
 * );
 * ```
 */
export const SPDR_ABILITIES: AbilityRegistry = mergeRegistries(SPDR_IDENTITY, SPDR_OBLIGATION_NEMESIS);
