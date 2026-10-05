import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { CABLE_IDENTITY } from "./identity.js";
import { CABLE_EVENTS } from "./events.js";
import { CABLE_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
import { CABLE_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";

/** Every scripted ability of this group, merged from its modules. Adding a module is an import and a line here. */
export const CABLE_ABILITIES: AbilityRegistry = mergeRegistries(
  CABLE_IDENTITY,
  CABLE_EVENTS,
  CABLE_SUPPORT_UPGRADES_ALLIES,
  CABLE_OBLIGATION_NEMESIS,
);
