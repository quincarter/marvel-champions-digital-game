import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { JUBILEE_HERO_ABILITIES } from "./jubilee/index.js";
import { JUBILEE_ASPECT_BASIC } from "./aspect-basic.js";
import { ARCADE } from "./arcade.js";

/** Every scripted ability of this pack, merged from its modules. Adding a module is an import and a line here. */
export const JUBILEE_ABILITIES: AbilityRegistry = mergeRegistries(JUBILEE_HERO_ABILITIES, JUBILEE_ASPECT_BASIC, ARCADE);
