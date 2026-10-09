import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { MAGNETO_HERO_ABILITIES } from "./magneto/index.js";
import { MAGNETO_ASPECT_BASIC } from "./aspect-basic.js";
import { HELLFIRE } from "./hellfire.js";

/** Every scripted ability of this pack, merged from its modules. Adding a module is an import and a line here. */
export const MAGNETO_ABILITIES: AbilityRegistry = mergeRegistries(
  MAGNETO_HERO_ABILITIES,
  MAGNETO_ASPECT_BASIC,
  HELLFIRE,
);
