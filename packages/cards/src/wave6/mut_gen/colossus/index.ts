import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { COLOSSUS_EVENTS } from "./events.js";
import { COLOSSUS_IDENTITY } from "./identity.js";
import { COLOSSUS_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { COLOSSUS_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

/**
 * Every Colossus (`mut_gen` 32001a-32029 range) ability scripted directly (docs/phase7-wave6.md). His identity
 * (32001a/b), events (32007-32010) and obligation + nemesis set (32025-32029) are scripted here; supports/upgrades/allies are separate.
 * Adding one is an import and a spread line here (mirrors `../../../wave5/sm/ghost-spider/index.ts`).
 */
export const COLOSSUS_ABILITIES: AbilityRegistry = mergeRegistries(
  COLOSSUS_IDENTITY,
  COLOSSUS_EVENTS,
  COLOSSUS_OBLIGATION_NEMESIS,
  COLOSSUS_SUPPORT_UPGRADES_ALLIES,
);
