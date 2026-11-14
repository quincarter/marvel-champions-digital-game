import { BP_CARDS, BP_ENCOUNTER_SETS, BP_PACK, BP_SCENARIOS, BP_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { BP_ASPECT_BASIC } from "./aspect-basic.js";
import { BLACK_PANTHER_EVENTS } from "./black-panther/events.js";
import { BLACK_PANTHER_IDENTITY } from "./black-panther/identity.js";
import { BLACK_PANTHER_OBLIGATION_NEMESIS } from "./black-panther/obligation-nemesis.js";
import { BLACK_PANTHER_SUPPORT_UPGRADES_ALLIES } from "./black-panther/support-upgrades-allies.js";
import { EXTREME_RISK } from "./extreme-risk.js";

/**
 * The `bp` product as a built-in pack: its cards and every script they need.
 *
 * The Black Panther/Shuri hero pack (with the Extreme Risk modular set), scripted from per-group modules. See
 * docs/phase7-wave9.md.
 */
export const BP_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "bp", kind: "hero", name: BP_PACK.name, product: BP_PACK },
  cards: BP_CARDS,
  encounterSets: BP_ENCOUNTER_SETS,
  scenarios: BP_SCENARIOS,
  decks: BP_STARTER_DECKS,
  abilities: mergeRegistries(
    BP_ASPECT_BASIC,
    BLACK_PANTHER_EVENTS,
    BLACK_PANTHER_IDENTITY,
    BLACK_PANTHER_OBLIGATION_NEMESIS,
    BLACK_PANTHER_SUPPORT_UPGRADES_ALLIES,
    EXTREME_RISK,
  ),
});
