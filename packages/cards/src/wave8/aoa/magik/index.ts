import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { MAGIK_IDENTITY } from "./identity.js";
import { MAGIK_EVENTS } from "./events.js";
import { MAGIK_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
import { MAGIK_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";

/** Every scripted ability of this group, merged from its modules. Adding a module is an import and a line here. */
export const MAGIK_HERO_ABILITIES: AbilityRegistry = mergeRegistries(
  MAGIK_IDENTITY,
  MAGIK_EVENTS,
  MAGIK_SUPPORT_UPGRADES_ALLIES,
  MAGIK_OBLIGATION_NEMESIS,
);
