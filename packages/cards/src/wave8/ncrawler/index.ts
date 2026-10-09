import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { NIGHTCRAWLER_HERO_ABILITIES } from "./nightcrawler/index.js";
import { NCRAWLER_ASPECT_BASIC } from "./aspect-basic.js";
import { CRAZY_GANG } from "./crazy-gang.js";

/** Every scripted ability of this pack, merged from its modules. Adding a module is an import and a line here. */
export const NCRAWLER_ABILITIES: AbilityRegistry = mergeRegistries(
  NIGHTCRAWLER_HERO_ABILITIES,
  NCRAWLER_ASPECT_BASIC,
  CRAZY_GANG,
);
