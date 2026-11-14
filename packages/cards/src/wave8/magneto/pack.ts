import {
  MAGNETO_CARDS,
  MAGNETO_ENCOUNTER_SETS,
  MAGNETO_PACK,
  MAGNETO_SCENARIOS,
  MAGNETO_STARTER_DECKS,
} from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { MAGNETO_HERO_ABILITIES } from "./magneto/index.js";
import { MAGNETO_ASPECT_BASIC } from "./aspect-basic.js";
import { HELLFIRE } from "./hellfire.js";

/**
 * The `magneto` product as a built-in pack: its cards and every script they need.
 *
 * The Magneto hero pack (with the Hellfire modular set), scripted from per-group modules. See docs/phase7-wave8.md.
 */
export const MAGNETO_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "magneto", kind: "hero", name: MAGNETO_PACK.name, product: MAGNETO_PACK },
  cards: MAGNETO_CARDS,
  encounterSets: MAGNETO_ENCOUNTER_SETS,
  scenarios: MAGNETO_SCENARIOS,
  decks: MAGNETO_STARTER_DECKS,
  abilities: mergeRegistries(MAGNETO_HERO_ABILITIES, MAGNETO_ASPECT_BASIC, HELLFIRE),
});
