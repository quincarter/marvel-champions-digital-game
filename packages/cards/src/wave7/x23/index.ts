import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { X23_IDENTITY } from "./identity.js";
import { X23_EVENTS } from "./events.js";
import { X23_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
import { X23_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { X23_PACK_CARDS } from "./pack-cards.js";

/** Every scripted ability of this group, merged from its modules. Adding a module is an import and a line here. */
export const X23_ABILITIES: AbilityRegistry = mergeRegistries(
  X23_IDENTITY,
  X23_EVENTS,
  X23_SUPPORT_UPGRADES_ALLIES,
  X23_OBLIGATION_NEMESIS,
  X23_PACK_CARDS,
);
