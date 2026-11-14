import { ICEMAN_CARDS, ICEMAN_ENCOUNTER_SETS, ICEMAN_PACK, ICEMAN_SCENARIOS, ICEMAN_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { ICEMAN_HERO_ABILITIES } from "./iceman/index.js";
import { ICEMAN_ASPECT_BASIC } from "./aspect-basic.js";
import { SAURON } from "./sauron.js";

/**
 * The `iceman` product as a built-in pack: its cards and every script they need.
 *
 * The Iceman hero pack (with the Sauron modular set), scripted from per-group modules. See docs/phase7-wave8.md.
 */
export const ICEMAN_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "iceman", kind: "hero", name: ICEMAN_PACK.name, product: ICEMAN_PACK },
  cards: ICEMAN_CARDS,
  encounterSets: ICEMAN_ENCOUNTER_SETS,
  scenarios: ICEMAN_SCENARIOS,
  decks: ICEMAN_STARTER_DECKS,
  abilities: mergeRegistries(ICEMAN_HERO_ABILITIES, ICEMAN_ASPECT_BASIC, SAURON),
});
