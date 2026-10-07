import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { ANGEL_IDENTITY } from "./identity.js";
import { ANGEL_EVENTS } from "./events.js";
import { ANGEL_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
import { ANGEL_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { ANGEL_PACK_CARDS } from "./pack-cards.js";

/** Every scripted ability of this group, merged from its modules. Adding a module is an import and a line here. */
export const ANGEL_ABILITIES: AbilityRegistry = mergeRegistries(
  ANGEL_IDENTITY,
  ANGEL_EVENTS,
  ANGEL_SUPPORT_UPGRADES_ALLIES,
  ANGEL_OBLIGATION_NEMESIS,
  ANGEL_PACK_CARDS,
);
