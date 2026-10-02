import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { PHOENIX_EVENTS } from "./events.js";
import { PHOENIX_IDENTITY } from "./identity.js";

/**
 * Every Phoenix (`phoenix` 34001a-34035 range) ability scripted directly (docs/phase7-wave6.md §6.1). Her identity
 * (34001a/b) and Phoenix Force (34002a/b) are scripted here; events, supports/upgrades/allies and her obligation +
 * Dark Phoenix nemesis set are not started. Adding one is an import and a spread line here (mirrors
 * `../../cyclops/cyclops/index.ts`).
 */
export const PHOENIX_HERO_ABILITIES: AbilityRegistry = mergeRegistries(PHOENIX_IDENTITY, PHOENIX_EVENTS);
