import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { WOLVERINE_IDENTITY } from "./identity.js";

/**
 * Every Wolverine (`wolv` 35001a-35026 range) ability scripted directly (docs/phase7-wave6.md §6.1). Only his identity
 * (35001a/b) is scripted; Wolverine's Claws (35002) waits on §3.42, and his events, supports/upgrades/allies and
 * obligation + Omega Red nemesis set are not started. Adding one is an import and a spread line here.
 */
export const WOLVERINE_HERO_ABILITIES: AbilityRegistry = mergeRegistries(WOLVERINE_IDENTITY);
