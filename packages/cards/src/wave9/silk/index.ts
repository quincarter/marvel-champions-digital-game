import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { SILK_ASPECT_BASIC } from "./aspect-basic.js";
import { GROWING_STRONG } from "./growing-strong.js";
import { SILK_EVENTS } from "./silk/events.js";
import { SILK_IDENTITY } from "./silk/identity.js";
import { SILK_OBLIGATION_NEMESIS } from "./silk/obligation-nemesis.js";
import { SILK_SUPPORT_UPGRADES_ALLIES } from "./silk/support-upgrades-allies.js";

/** Every scripted ability of this pack, merged from its modules. Adding a module is an import and a line here. */
export const SILK_ABILITIES: AbilityRegistry = mergeRegistries(
  SILK_ASPECT_BASIC,
  GROWING_STRONG,
  SILK_EVENTS,
  SILK_IDENTITY,
  SILK_OBLIGATION_NEMESIS,
  SILK_SUPPORT_UPGRADES_ALLIES,
);
