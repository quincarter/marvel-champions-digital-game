import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { PSYLOCKE_IDENTITY } from "./identity.js";
import { PSYLOCKE_EVENTS } from "./events.js";
import { PSYLOCKE_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
import { PSYLOCKE_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { PSYLOCKE_PACK_CARDS } from "./pack-cards.js";

/** Every scripted ability of this group, merged from its modules. Adding a module is an import and a line here. */
export const PSYLOCKE_ABILITIES: AbilityRegistry = mergeRegistries(
  PSYLOCKE_IDENTITY,
  PSYLOCKE_EVENTS,
  PSYLOCKE_SUPPORT_UPGRADES_ALLIES,
  PSYLOCKE_OBLIGATION_NEMESIS,
  PSYLOCKE_PACK_CARDS,
);
