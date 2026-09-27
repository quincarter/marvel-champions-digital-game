import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { SPIDER_MAN_MORALES_EVENTS } from "./events.js";
import { SPIDER_MAN_MORALES_IDENTITY } from "./identity.js";
import { SPIDER_MAN_MORALES_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";

/**
 * Every Spider-Man / Miles Morales (`sm` 27030a–27060) ability scripted directly (docs/phase7-wave5.md). His
 * identity (27030a/b), his own events (27031–27034, plus the precon's 27042–27043 and 27050), and his obligation
 * and nemesis set (Keeping Secrets, Tracking Prey, Prowler, Razor Claws, Slice and Dice ×2, 27056–27060) are
 * scripted so far. **Adding the rest is one import + one spread line here**, mirroring `../ghost-spider/index.ts`'s
 * shape:
 *
 * ```ts
 * import { SPIDER_MAN_MORALES_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
 * // …
 * export const SPIDER_MAN_MORALES_ABILITIES: AbilityRegistry = mergeRegistries(
 *   SPIDER_MAN_MORALES_IDENTITY,
 *   SPIDER_MAN_MORALES_EVENTS,
 *   SPIDER_MAN_MORALES_SUPPORT_UPGRADES_ALLIES,
 *   SPIDER_MAN_MORALES_OBLIGATION_NEMESIS,
 * );
 * ```
 */
export const SPIDER_MAN_MORALES_ABILITIES: AbilityRegistry = mergeRegistries(
  SPIDER_MAN_MORALES_IDENTITY,
  SPIDER_MAN_MORALES_EVENTS,
  SPIDER_MAN_MORALES_OBLIGATION_NEMESIS,
);
