import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { STORM_EVENTS } from "./events.js";
import { STORM_IDENTITY } from "./identity.js";
import { STORM_WEATHER } from "./weather.js";

/**
 * Every Storm (`storm` 36001a-36035 range) ability scripted directly (docs/phase7-wave6.md §6.2). Her identity
 * (36001a/b) and her four WEATHER supports (36002-36005, `weather.ts`) and her five hero-kit events (36009-36013, `events.ts`) are scripted; her other supports,
 * upgrades and allies, and her obligation + Callisto nemesis set are not started. Adding one is an import and a spread
 * line here.
 */
export const STORM_HERO_ABILITIES: AbilityRegistry = mergeRegistries(STORM_IDENTITY, STORM_WEATHER, STORM_EVENTS);
