import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { MAGNETO_IDENTITY } from "./identity.js";
import { MAGNETO_EVENTS } from "./events.js";
import { MAGNETO_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
import { MAGNETO_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";

/** Every scripted ability of this group, merged from its modules. Adding a module is an import and a line here. */
export const MAGNETO_HERO_ABILITIES: AbilityRegistry = mergeRegistries(
  MAGNETO_IDENTITY,
  MAGNETO_EVENTS,
  MAGNETO_SUPPORT_UPGRADES_ALLIES,
  MAGNETO_OBLIGATION_NEMESIS,
);
