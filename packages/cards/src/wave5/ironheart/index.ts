import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { IRONHEART_ALLIES } from "./allies.js";
import { IRONHEART_EVENTS } from "./events.js";
import { IRONHEART_IDENTITY } from "./identity.js";
import { IRONHEART_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { IRONHEART_SUPPORT_UPGRADES } from "./support-upgrades.js";
import { IRONHEART_ZZZAX } from "./zzzax.js";

/**
 * Every Ironheart (`ironheart` 29001a-29040) ability scripted directly (docs/phase7-wave5.md). Her identity
 * (29001a-29003a/29001b-29003b), signature events (29005-29008, 29017-29019, 29025), non-signature allies (29004,
 * 29014-29016, 29022-29024, `allies.ts`), supports/upgrades/resources (29009-29013, 29020-29021, 29026-29027,
 * `support-upgrades.ts`), her obligation/nemesis set (29028-29032, `obligation-nemesis.ts`) and the Zzzax modular
 * set (29033-29040, `zzzax.ts`) are all
 * scripted.
 */
export const IRONHEART_ABILITIES: AbilityRegistry = mergeRegistries(
  IRONHEART_IDENTITY,
  IRONHEART_EVENTS,
  IRONHEART_ALLIES,
  IRONHEART_SUPPORT_UPGRADES,
  IRONHEART_OBLIGATION_NEMESIS,
  IRONHEART_ZZZAX,
);
