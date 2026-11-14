import {
  SPIDERHAM_CARDS,
  SPIDERHAM_ENCOUNTER_SETS,
  SPIDERHAM_PACK,
  SPIDERHAM_SCENARIOS,
  SPIDERHAM_STARTER_DECKS,
} from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { SPIDERHAM_ALLIES } from "./allies.js";
import { SPIDERHAM_EVENTS } from "./events.js";
import { SPIDERHAM_IDENTITY } from "./identity.js";
import { SPIDERHAM_INHERITORS } from "./inheritors.js";
import { SPIDERHAM_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { SPIDERHAM_SUPPORT_UPGRADES } from "./support-upgrades.js";

/**
 * The `spiderham` product as a built-in pack: its cards and every script they need.
 *
 * The identity, events, allies, supports/upgrades, obligation/nemesis set and the Inheritors modular set, one module
 * each. See docs/phase7-wave5.md.
 */
export const SPIDERHAM_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "spiderham", kind: "hero", name: SPIDERHAM_PACK.name, product: SPIDERHAM_PACK },
  cards: SPIDERHAM_CARDS,
  encounterSets: SPIDERHAM_ENCOUNTER_SETS,
  scenarios: SPIDERHAM_SCENARIOS,
  decks: SPIDERHAM_STARTER_DECKS,
  abilities: mergeRegistries(
    SPIDERHAM_IDENTITY,
    SPIDERHAM_EVENTS,
    SPIDERHAM_ALLIES,
    SPIDERHAM_SUPPORT_UPGRADES,
    SPIDERHAM_OBLIGATION_NEMESIS,
    SPIDERHAM_INHERITORS,
  ),
});
