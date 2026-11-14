import { ANGEL_CARDS, ANGEL_ENCOUNTER_SETS, ANGEL_PACK, ANGEL_SCENARIOS, ANGEL_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { ANGEL_EVENTS } from "./events.js";
import { ANGEL_IDENTITY } from "./identity.js";
import { ANGEL_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { ANGEL_PACK_CARDS } from "./pack-cards.js";
import { ANGEL_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

/**
 * The `angel` product as a built-in pack: its cards and every script they need, one module per card group (identity,
 * events, supports/upgrades/allies, obligation and nemesis set, the pack's other cards).
 */
export const ANGEL_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "angel", kind: "hero", name: ANGEL_PACK.name, product: ANGEL_PACK },
  cards: ANGEL_CARDS,
  encounterSets: ANGEL_ENCOUNTER_SETS,
  scenarios: ANGEL_SCENARIOS,
  decks: ANGEL_STARTER_DECKS,
  abilities: mergeRegistries(
    ANGEL_IDENTITY,
    ANGEL_EVENTS,
    ANGEL_SUPPORT_UPGRADES_ALLIES,
    ANGEL_OBLIGATION_NEMESIS,
    ANGEL_PACK_CARDS,
  ),
});
