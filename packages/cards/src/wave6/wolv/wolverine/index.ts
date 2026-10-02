import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { WOLVERINE_EVENTS } from "./events.js";
import { WOLVERINE_IDENTITY } from "./identity.js";

/**
 * Every Wolverine (`wolv` 35001a-35026 range) ability scripted directly (docs/phase7-wave6.md §6.1). His identity (35001a/b) and
 * events (35008, 35009, 35011, 35012; Lunging Strike 35010 waits on §3.42) are scripted; Wolverine's Claws (35002) waits on §3.42, and his supports/upgrades/allies and
 * obligation + Omega Red nemesis set are not started. Adding one is an import and a spread line here.
 */
export const WOLVERINE_HERO_ABILITIES: AbilityRegistry = mergeRegistries(WOLVERINE_IDENTITY, WOLVERINE_EVENTS);
