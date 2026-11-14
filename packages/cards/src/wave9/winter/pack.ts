import { WINTER_CARDS, WINTER_ENCOUNTER_SETS, WINTER_PACK, WINTER_SCENARIOS, WINTER_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { WINTER_ASPECT_BASIC } from "./aspect-basic.js";
import { WHITEOUT } from "./whiteout.js";
import { WINTER_SOLDIER_EVENTS } from "./winter-soldier/events.js";
import { WINTER_SOLDIER_IDENTITY } from "./winter-soldier/identity.js";
import { WINTER_SOLDIER_OBLIGATION_NEMESIS } from "./winter-soldier/obligation-nemesis.js";
import { WINTER_SOLDIER_SUPPORT_UPGRADES_ALLIES } from "./winter-soldier/support-upgrades-allies.js";

/**
 * The `winter` product as a built-in pack: its cards and every script they need.
 *
 * The Winter Soldier hero pack (with the Whiteout modular set), scripted from per-group modules. See
 * docs/phase7-wave9.md.
 */
export const WINTER_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "winter", kind: "hero", name: WINTER_PACK.name, product: WINTER_PACK },
  cards: WINTER_CARDS,
  encounterSets: WINTER_ENCOUNTER_SETS,
  scenarios: WINTER_SCENARIOS,
  decks: WINTER_STARTER_DECKS,
  abilities: mergeRegistries(
    WINTER_ASPECT_BASIC,
    WHITEOUT,
    WINTER_SOLDIER_EVENTS,
    WINTER_SOLDIER_IDENTITY,
    WINTER_SOLDIER_OBLIGATION_NEMESIS,
    WINTER_SOLDIER_SUPPORT_UPGRADES_ALLIES,
  ),
});
