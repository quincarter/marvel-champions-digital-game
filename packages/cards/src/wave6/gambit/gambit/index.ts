import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { GAMBIT_EVENTS } from "./events.js";
import { GAMBIT_IDENTITY } from "./identity.js";
import { GAMBIT_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { GAMBIT_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

/**
 * Every Gambit (`gambit`, 37001a-37031 range) ability scripted directly (docs/phase7-wave6.md §6.2): his identity
 * (37001a/b, `identity.ts`) so far. Events, supports/upgrades/allies and the obligation + Belladonna nemesis set have
 * their own (still empty) modules. Adding one is an import and a line here.
 */
export const GAMBIT_HERO_ABILITIES: AbilityRegistry = mergeRegistries(
  GAMBIT_IDENTITY,
  GAMBIT_EVENTS,
  GAMBIT_SUPPORT_UPGRADES_ALLIES,
  GAMBIT_OBLIGATION_NEMESIS,
);
