import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { ICEMAN_HERO_ABILITIES } from "./iceman/index.js";
import { ICEMAN_ASPECT_BASIC } from "./aspect-basic.js";
import { SAURON } from "./sauron.js";

/** Every scripted ability of this pack, merged from its modules. Adding a module is an import and a line here. */
export const ICEMAN_ABILITIES: AbilityRegistry = mergeRegistries(ICEMAN_HERO_ABILITIES, ICEMAN_ASPECT_BASIC, SAURON);
