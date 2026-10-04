import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { CYCLOPS_EVENTS } from "./events.js";
import { CYCLOPS_IDENTITY } from "./identity.js";
import { CYCLOPS_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { CYCLOPS_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

/**
 * Every Cyclops (`cyclops` 33001a-33032 range) ability scripted directly (docs/phase7-wave6.md §6.1). His identity
 * (33001a/b), signature events (33008-33010) and supports/upgrades/allies, obligation (33027) and Mister Sinister nemesis set (33028-33031) are scripted here. Adding one is an import and a spread line here (mirrors `../../mut_gen/colossus/index.ts`).
 */
export const CYCLOPS_HERO_ABILITIES: AbilityRegistry = mergeRegistries(
  CYCLOPS_IDENTITY,
  CYCLOPS_EVENTS,
  CYCLOPS_SUPPORT_UPGRADES_ALLIES,
  CYCLOPS_OBLIGATION_NEMESIS,
);
