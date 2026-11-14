import { TT_CARDS, TT_ENCOUNTER_SETS, TT_PACK, TT_SCENARIOS, TT_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { TT_ASPECT_BASIC } from "./aspect-basic.js";
import { ENCHANTRESS } from "./enchantress.js";
import { GOD_OF_LIES } from "./god-of-lies.js";
import { TRICKSTER_MAGIC } from "./trickster-magic.js";

/**
 * The `tt` product as a built-in pack: its cards and every script they need.
 *
 * The Trickster Takeover scenario pack (Enchantress and God of Lies, the Trickster Magic modular set, and its
 * player cards), scripted from per-group modules. See docs/phase7-wave9.md.
 */
export const TT_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "tt", kind: "scenario", name: TT_PACK.name, product: TT_PACK },
  cards: TT_CARDS,
  encounterSets: TT_ENCOUNTER_SETS,
  scenarios: TT_SCENARIOS,
  decks: TT_STARTER_DECKS,
  abilities: mergeRegistries(TT_ASPECT_BASIC, ENCHANTRESS, GOD_OF_LIES, TRICKSTER_MAGIC),
});
