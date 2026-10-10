import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { WINTER_ASPECT_BASIC } from "./aspect-basic.js";
import { WHITEOUT } from "./whiteout.js";
import { WINTER_SOLDIER_EVENTS } from "./winter-soldier/events.js";
import { WINTER_SOLDIER_IDENTITY } from "./winter-soldier/identity.js";
import { WINTER_SOLDIER_OBLIGATION_NEMESIS } from "./winter-soldier/obligation-nemesis.js";
import { WINTER_SOLDIER_SUPPORT_UPGRADES_ALLIES } from "./winter-soldier/support-upgrades-allies.js";

/** Every scripted ability of this pack, merged from its modules. Adding a module is an import and a line here. */
export const WINTER_ABILITIES: AbilityRegistry = mergeRegistries(
  WINTER_ASPECT_BASIC,
  WHITEOUT,
  WINTER_SOLDIER_EVENTS,
  WINTER_SOLDIER_IDENTITY,
  WINTER_SOLDIER_OBLIGATION_NEMESIS,
  WINTER_SOLDIER_SUPPORT_UPGRADES_ALLIES,
);
