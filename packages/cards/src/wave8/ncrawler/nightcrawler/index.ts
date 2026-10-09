import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { NIGHTCRAWLER_IDENTITY } from "./identity.js";
import { NIGHTCRAWLER_EVENTS } from "./events.js";
import { NIGHTCRAWLER_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
import { NIGHTCRAWLER_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";

/** Every scripted ability of this group, merged from its modules. Adding a module is an import and a line here. */
export const NIGHTCRAWLER_HERO_ABILITIES: AbilityRegistry = mergeRegistries(
  NIGHTCRAWLER_IDENTITY,
  NIGHTCRAWLER_EVENTS,
  NIGHTCRAWLER_SUPPORT_UPGRADES_ALLIES,
  NIGHTCRAWLER_OBLIGATION_NEMESIS,
);
