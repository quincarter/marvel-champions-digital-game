import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { DEADPOOL_IDENTITY } from "./identity.js";
import { DEADPOOL_EVENTS } from "./events.js";
import { DEADPOOL_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
import { DEADPOOL_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { DEADPOOL_PACK_CARDS } from "./pack-cards.js";
import { DREADPOOL } from "./dreadpool.js";

/** Every scripted ability of this group, merged from its modules. Adding a module is an import and a line here. */
export const DEADPOOL_ABILITIES: AbilityRegistry = mergeRegistries(
  DEADPOOL_IDENTITY,
  DEADPOOL_EVENTS,
  DEADPOOL_SUPPORT_UPGRADES_ALLIES,
  DEADPOOL_OBLIGATION_NEMESIS,
  DEADPOOL_PACK_CARDS,
  DREADPOOL,
);
