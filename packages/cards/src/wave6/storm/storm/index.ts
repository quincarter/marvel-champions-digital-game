import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { STORM_EVENTS } from "./events.js";
import { STORM_IDENTITY } from "./identity.js";
import { STORM_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { STORM_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
import { STORM_WEATHER } from "./weather.js";

/**
 * Every Storm (`storm` 36001a-36035 range) ability scripted directly (docs/phase7-wave6.md §6.2): her identity
 * (36001a/b), her four WEATHER supports (36002-36005, `weather.ts`), her five hero-kit events (36009-36013,
 * `events.ts`) and her supports, upgrades and allies (`support-upgrades-allies.ts`). Her obligation + Callisto nemesis
 * set (`obligation-nemesis.ts`, 36030-36034; Claustrophobia's flip is a data gap) are scripted. Adding one is an import and a spread line here.
 */
export const STORM_HERO_ABILITIES: AbilityRegistry = mergeRegistries(
  STORM_IDENTITY,
  STORM_WEATHER,
  STORM_EVENTS,
  STORM_SUPPORT_UPGRADES_ALLIES,
  STORM_OBLIGATION_NEMESIS,
);
