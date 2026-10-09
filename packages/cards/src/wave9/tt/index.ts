import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { TT_ASPECT_BASIC } from "./aspect-basic.js";
import { ENCHANTRESS } from "./enchantress.js";
import { GOD_OF_LIES } from "./god-of-lies.js";
import { TRICKSTER_MAGIC } from "./trickster-magic.js";

/** Every scripted ability of this pack, merged from its modules. Adding a module is an import and a line here. */
export const TT_ABILITIES: AbilityRegistry = mergeRegistries(
  TT_ASPECT_BASIC,
  ENCHANTRESS,
  GOD_OF_LIES,
  TRICKSTER_MAGIC,
);
