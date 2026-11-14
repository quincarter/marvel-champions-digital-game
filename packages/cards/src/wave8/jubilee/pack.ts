import {
  JUBILEE_CARDS,
  JUBILEE_ENCOUNTER_SETS,
  JUBILEE_PACK,
  JUBILEE_SCENARIOS,
  JUBILEE_STARTER_DECKS,
} from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { JUBILEE_HERO_ABILITIES } from "./jubilee/index.js";
import { JUBILEE_ASPECT_BASIC } from "./aspect-basic.js";
import { ARCADE } from "./arcade.js";

/**
 * The `jubilee` product as a built-in pack: its cards and every script they need.
 *
 * The Jubilee hero pack (with the Arcade modular set), scripted from per-group modules. See docs/phase7-wave8.md.
 */
export const JUBILEE_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "jubilee", kind: "hero", name: JUBILEE_PACK.name, product: JUBILEE_PACK },
  cards: JUBILEE_CARDS,
  encounterSets: JUBILEE_ENCOUNTER_SETS,
  scenarios: JUBILEE_SCENARIOS,
  decks: JUBILEE_STARTER_DECKS,
  abilities: mergeRegistries(JUBILEE_HERO_ABILITIES, JUBILEE_ASPECT_BASIC, ARCADE),
});
