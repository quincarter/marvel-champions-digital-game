import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { SPIDERHAM_ALLIES } from "./allies.js";
import { SPIDERHAM_EVENTS } from "./events.js";
import { SPIDERHAM_IDENTITY } from "./identity.js";
import { SPIDERHAM_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { SPIDERHAM_SUPPORT_UPGRADES } from "./support-upgrades.js";

/**
 * Every Spider-Ham (`spiderham` 30001a-30038) ability scripted directly (docs/phase7-wave5.md). Only his identity
 * (30001a/b) is scripted so far. **Adding the rest is one import + one spread line here**, mirroring
 * `../nova/index.ts`'s shape:
 *
 * ```ts
 * import { SPIDERHAM_EVENTS } from "./events.js";
 * import { SPIDERHAM_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
 * import { SPIDERHAM_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
 * import { SPIDERHAM_INHERITORS } from "./inheritors.js";
 * // …
 * export const SPIDERHAM_ABILITIES: AbilityRegistry = mergeRegistries(
 *   SPIDERHAM_IDENTITY,
 *   SPIDERHAM_EVENTS,
 *   SPIDERHAM_SUPPORT_UPGRADES_ALLIES,
 *   SPIDERHAM_OBLIGATION_NEMESIS,
 *   SPIDERHAM_INHERITORS,
 * );
 * ```
 */
export const SPIDERHAM_ABILITIES: AbilityRegistry = mergeRegistries(
  SPIDERHAM_IDENTITY,
  SPIDERHAM_EVENTS,
  SPIDERHAM_ALLIES,
  SPIDERHAM_SUPPORT_UPGRADES,
  SPIDERHAM_OBLIGATION_NEMESIS,
);
