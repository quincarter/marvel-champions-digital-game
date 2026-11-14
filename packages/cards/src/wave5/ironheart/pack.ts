import {
  IRONHEART_CARDS,
  IRONHEART_ENCOUNTER_SETS,
  IRONHEART_PACK,
  IRONHEART_SCENARIOS,
  IRONHEART_STARTER_DECKS,
} from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { IRONHEART_ALLIES } from "./allies.js";
import { IRONHEART_EVENTS } from "./events.js";
import { IRONHEART_IDENTITY } from "./identity.js";
import { IRONHEART_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { IRONHEART_SUPPORT_UPGRADES } from "./support-upgrades.js";
import { IRONHEART_ZZZAX } from "./zzzax.js";

/**
 * The `ironheart` product as a built-in pack: its cards and every script they need.
 *
 * Every card is scripted: the identity (29001a-29003a/29001b-29003b, `identity.ts`), signature events (29005-29008,
 * 29017-29019, 29025, `events.ts`), non-signature allies (29004, 29014-29016, 29022-29024, `allies.ts`),
 * supports/upgrades/resources (29009-29013, 29020-29021, 29026-29027, `support-upgrades.ts`), the obligation/nemesis
 * set (29028-29032, `obligation-nemesis.ts`) and the Zzzax modular set (29033-29040, `zzzax.ts`). See
 * docs/phase7-wave5.md.
 */
export const IRONHEART_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "ironheart", kind: "hero", name: IRONHEART_PACK.name, product: IRONHEART_PACK },
  cards: IRONHEART_CARDS,
  encounterSets: IRONHEART_ENCOUNTER_SETS,
  scenarios: IRONHEART_SCENARIOS,
  decks: IRONHEART_STARTER_DECKS,
  abilities: mergeRegistries(
    IRONHEART_IDENTITY,
    IRONHEART_EVENTS,
    IRONHEART_ALLIES,
    IRONHEART_SUPPORT_UPGRADES,
    IRONHEART_OBLIGATION_NEMESIS,
    IRONHEART_ZZZAX,
  ),
});
