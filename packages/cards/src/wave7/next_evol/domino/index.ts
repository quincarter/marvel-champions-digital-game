import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { DOMINO_IDENTITY } from "./identity.js";
import { DOMINO_EVENTS } from "./events.js";
import { DOMINO_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
import { DOMINO_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";

/** Every scripted ability of this group, merged from its modules. Adding a module is an import and a line here. */
export const DOMINO_ABILITIES: AbilityRegistry = mergeRegistries(
  DOMINO_IDENTITY,
  DOMINO_EVENTS,
  DOMINO_SUPPORT_UPGRADES_ALLIES,
  DOMINO_OBLIGATION_NEMESIS,
);
