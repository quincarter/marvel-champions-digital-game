import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { SHADOWCAT_IDENTITY } from "./identity.js";

/**
 * Every Shadowcat (`mut_gen` 32030a-32055 range) ability scripted directly (docs/phase7-wave6.md). Her identity and
 * mass form upgrade (32030a/b, 32031a/b) are scripted here; events, supports/upgrades/allies and obligation + nemesis
 * are not started. Adding one is an import and a spread line here (mirrors `../colossus/index.ts`).
 */
export const SHADOWCAT_ABILITIES: AbilityRegistry = mergeRegistries(SHADOWCAT_IDENTITY);
