import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { FALCON_ASPECT_BASIC } from "./aspect-basic.js";
import { FALCON_EVENTS } from "./falcon/events.js";
import { FALCON_IDENTITY } from "./falcon/identity.js";
import { FALCON_OBLIGATION_NEMESIS } from "./falcon/obligation-nemesis.js";
import { FALCON_SUPPORT_UPGRADES_ALLIES } from "./falcon/support-upgrades-allies.js";
import { TECHNO } from "./techno.js";

/** Every scripted ability of this pack, merged from its modules. Adding a module is an import and a line here. */
export const FALCON_ABILITIES: AbilityRegistry = mergeRegistries(
  FALCON_ASPECT_BASIC,
  FALCON_EVENTS,
  FALCON_IDENTITY,
  FALCON_OBLIGATION_NEMESIS,
  FALCON_SUPPORT_UPGRADES_ALLIES,
  TECHNO,
);
