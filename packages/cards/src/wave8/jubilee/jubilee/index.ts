import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { JUBILEE_IDENTITY } from "./identity.js";
import { JUBILEE_EVENTS } from "./events.js";
import { JUBILEE_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
import { JUBILEE_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";

/** Every scripted ability of this group, merged from its modules. Adding a module is an import and a line here. */
export const JUBILEE_HERO_ABILITIES: AbilityRegistry = mergeRegistries(
  JUBILEE_IDENTITY,
  JUBILEE_EVENTS,
  JUBILEE_SUPPORT_UPGRADES_ALLIES,
  JUBILEE_OBLIGATION_NEMESIS,
);
