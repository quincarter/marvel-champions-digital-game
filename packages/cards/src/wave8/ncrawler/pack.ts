import {
  NCRAWLER_CARDS,
  NCRAWLER_ENCOUNTER_SETS,
  NCRAWLER_PACK,
  NCRAWLER_SCENARIOS,
  NCRAWLER_STARTER_DECKS,
} from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { NIGHTCRAWLER_HERO_ABILITIES } from "./nightcrawler/index.js";
import { NCRAWLER_ASPECT_BASIC } from "./aspect-basic.js";
import { CRAZY_GANG } from "./crazy-gang.js";

/**
 * The `ncrawler` product as a built-in pack: its cards and every script they need.
 *
 * The Nightcrawler hero pack (with the Crazy Gang modular set), scripted from per-group modules. See
 * docs/phase7-wave8.md.
 */
export const NCRAWLER_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "ncrawler", kind: "hero", name: NCRAWLER_PACK.name, product: NCRAWLER_PACK },
  cards: NCRAWLER_CARDS,
  encounterSets: NCRAWLER_ENCOUNTER_SETS,
  scenarios: NCRAWLER_SCENARIOS,
  decks: NCRAWLER_STARTER_DECKS,
  abilities: mergeRegistries(NIGHTCRAWLER_HERO_ABILITIES, NCRAWLER_ASPECT_BASIC, CRAZY_GANG),
});
