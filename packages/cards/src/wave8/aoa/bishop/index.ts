import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { BISHOP_IDENTITY } from "./identity.js";
import { BISHOP_EVENTS } from "./events.js";
import { BISHOP_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
import { BISHOP_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";

/** Every scripted ability of this group, merged from its modules. Adding a module is an import and a line here. */
export const BISHOP_HERO_ABILITIES: AbilityRegistry = mergeRegistries(
  BISHOP_IDENTITY,
  BISHOP_EVENTS,
  BISHOP_SUPPORT_UPGRADES_ALLIES,
  BISHOP_OBLIGATION_NEMESIS,
);
