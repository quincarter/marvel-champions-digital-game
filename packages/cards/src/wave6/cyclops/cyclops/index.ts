import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { CYCLOPS_EVENTS } from "./events.js";
import { CYCLOPS_IDENTITY } from "./identity.js";

/**
 * Every Cyclops (`cyclops` 33001a-33032 range) ability scripted directly (docs/phase7-wave6.md §6.1). His identity
 * (33001a/b) and signature events (33008-33010) are scripted here; supports/upgrades/allies and obligation + nemesis are not started. Adding one is
 * an import and a spread line here (mirrors `../../mut_gen/colossus/index.ts`).
 */
export const CYCLOPS_HERO_ABILITIES: AbilityRegistry = mergeRegistries(CYCLOPS_IDENTITY, CYCLOPS_EVENTS);
