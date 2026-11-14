import { X23_CARDS, X23_ENCOUNTER_SETS, X23_PACK, X23_SCENARIOS, X23_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { X23_EVENTS } from "./events.js";
import { X23_IDENTITY } from "./identity.js";
import { X23_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { X23_PACK_CARDS } from "./pack-cards.js";
import { X23_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

/**
 * The `x23` product as a built-in pack: its cards and every script they need, one module per card group (identity,
 * events, supports/upgrades/allies, obligation and nemesis set, the pack's other cards).
 */
export const X23_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "x23", kind: "hero", name: X23_PACK.name, product: X23_PACK },
  cards: X23_CARDS,
  encounterSets: X23_ENCOUNTER_SETS,
  scenarios: X23_SCENARIOS,
  decks: X23_STARTER_DECKS,
  abilities: mergeRegistries(
    X23_IDENTITY,
    X23_EVENTS,
    X23_SUPPORT_UPGRADES_ALLIES,
    X23_OBLIGATION_NEMESIS,
    X23_PACK_CARDS,
  ),
});
