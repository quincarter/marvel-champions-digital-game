import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { BP_ASPECT_BASIC } from "./aspect-basic.js";
import { BLACK_PANTHER_EVENTS } from "./black-panther/events.js";
import { BLACK_PANTHER_IDENTITY } from "./black-panther/identity.js";
import { BLACK_PANTHER_OBLIGATION_NEMESIS } from "./black-panther/obligation-nemesis.js";
import { BLACK_PANTHER_SUPPORT_UPGRADES_ALLIES } from "./black-panther/support-upgrades-allies.js";
import { EXTREME_RISK } from "./extreme-risk.js";

/** Every scripted ability of this pack, merged from its modules. Adding a module is an import and a line here. */
export const BP_ABILITIES: AbilityRegistry = mergeRegistries(
  BP_ASPECT_BASIC,
  BLACK_PANTHER_EVENTS,
  BLACK_PANTHER_IDENTITY,
  BLACK_PANTHER_OBLIGATION_NEMESIS,
  BLACK_PANTHER_SUPPORT_UPGRADES_ALLIES,
  EXTREME_RISK,
);
