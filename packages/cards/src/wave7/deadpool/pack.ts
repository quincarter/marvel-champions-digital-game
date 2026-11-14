import {
  DEADPOOL_CARDS,
  DEADPOOL_ENCOUNTER_SETS,
  DEADPOOL_PACK,
  DEADPOOL_SCENARIOS,
  DEADPOOL_STARTER_DECKS,
} from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { DREADPOOL } from "./dreadpool.js";
import { DEADPOOL_EVENTS } from "./events.js";
import { DEADPOOL_IDENTITY } from "./identity.js";
import { DEADPOOL_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { DEADPOOL_PACK_CARDS } from "./pack-cards.js";
import { DEADPOOL_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

/**
 * The `deadpool` product as a built-in pack: its cards and every script they need, one module per card group (identity,
 * events, supports/upgrades/allies, obligation and nemesis set, the pack's other cards), plus Dreadpool.
 */
export const DEADPOOL_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "deadpool", kind: "hero", name: DEADPOOL_PACK.name, product: DEADPOOL_PACK },
  cards: DEADPOOL_CARDS,
  encounterSets: DEADPOOL_ENCOUNTER_SETS,
  scenarios: DEADPOOL_SCENARIOS,
  decks: DEADPOOL_STARTER_DECKS,
  abilities: mergeRegistries(
    DEADPOOL_IDENTITY,
    DEADPOOL_EVENTS,
    DEADPOOL_SUPPORT_UPGRADES_ALLIES,
    DEADPOOL_OBLIGATION_NEMESIS,
    DEADPOOL_PACK_CARDS,
    DREADPOOL,
  ),
});
