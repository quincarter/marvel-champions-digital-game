import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { BADOON } from "./badoon.js";
import { GROOT_KIT } from "./groot-kit.js";
import { GROOT_OBLIGATION_NEMESIS } from "./groot-obligation-nemesis.js";
import { ROCKET_KIT } from "./rocket-kit.js";
import { ROCKET_OBLIGATION_NEMESIS } from "./rocket-obligation-nemesis.js";
import { SHIP_COMMAND } from "./ship-command.js";

/**
 * Every The Galaxy's Most Wanted (`gmw`) ability scripted directly (i.e. not a reprint aliased by
 * `../reprints.ts`). See docs/phase7-wave3-scripting.md.
 */
export const GMW_ABILITIES: AbilityRegistry = mergeRegistries(
  GROOT_KIT,
  GROOT_OBLIGATION_NEMESIS,
  ROCKET_KIT,
  ROCKET_OBLIGATION_NEMESIS,
  SHIP_COMMAND,
  BADOON,
);
