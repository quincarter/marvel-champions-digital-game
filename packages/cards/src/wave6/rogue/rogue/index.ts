import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { ROGUE_EVENTS } from "./events.js";
import { ROGUE_IDENTITY } from "./identity.js";
import { ROGUE_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { ROGUE_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

/**
 * Every Rogue (`rogue`, 38001a-38028 range) ability scripted directly (docs/phase7-wave6.md §6.2): her identity and
 * Touched (`identity.ts`) so far. Events, supports/upgrades/allies and the obligation + nemesis set have their own
 * (still empty) modules. Adding one is an import and a line here.
 */
export const ROGUE_HERO_ABILITIES: AbilityRegistry = mergeRegistries(
  ROGUE_IDENTITY,
  ROGUE_EVENTS,
  ROGUE_SUPPORT_UPGRADES_ALLIES,
  ROGUE_OBLIGATION_NEMESIS,
);
