import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { COLOSSUS_EVENTS } from "./events.js";
import { COLOSSUS_IDENTITY } from "./identity.js";

/**
 * Every Colossus (`mut_gen` 32001a-32029 range) ability scripted directly (docs/phase7-wave6.md). Only his identity
 * (32001a/b) and events (32007-32010) are scripted so far; supports/upgrades/allies and the obligation + nemesis set are not started.
 * Adding one is an import and a spread line here (mirrors `../../../wave5/sm/ghost-spider/index.ts`).
 */
export const COLOSSUS_ABILITIES: AbilityRegistry = mergeRegistries(COLOSSUS_IDENTITY, COLOSSUS_EVENTS);
