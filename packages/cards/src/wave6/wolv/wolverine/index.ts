import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { WOLVERINE_EVENTS } from "./events.js";
import { WOLVERINE_IDENTITY } from "./identity.js";
import { WOLVERINE_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { WOLVERINE_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

/**
 * Every Wolverine (`wolv` 35001a-35031 range) ability scripted directly (docs/phase7-wave6.md §6.1). His identity
 * (35001a/b) with Wolverine's Claws (35002, §3.42), events (35008-35012), supports/upgrades/allies (Jubilee 35003,
 * §3.43) and his obligation + Omega Red nemesis set (35027-35031) are scripted. Adding one is an import and a spread
 * line here.
 */
export const WOLVERINE_HERO_ABILITIES: AbilityRegistry = mergeRegistries(
  WOLVERINE_IDENTITY,
  WOLVERINE_EVENTS,
  WOLVERINE_SUPPORT_UPGRADES_ALLIES,
  WOLVERINE_OBLIGATION_NEMESIS,
);
