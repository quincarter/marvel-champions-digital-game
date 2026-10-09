import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { ICEMAN_IDENTITY } from "./identity.js";
import { ICEMAN_EVENTS } from "./events.js";
import { ICEMAN_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
import { ICEMAN_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";

/** Every scripted ability of this group, merged from its modules. Adding a module is an import and a line here. */
export const ICEMAN_HERO_ABILITIES: AbilityRegistry = mergeRegistries(
  ICEMAN_IDENTITY,
  ICEMAN_EVENTS,
  ICEMAN_SUPPORT_UPGRADES_ALLIES,
  ICEMAN_OBLIGATION_NEMESIS,
);
