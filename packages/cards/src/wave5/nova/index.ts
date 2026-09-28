import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { NOVA_EVENTS } from "./events.js";
import { NOVA_IDENTITY } from "./identity.js";
import { NOVA_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { NOVA_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

/**
 * Every Nova (`nova` 28001a–28032) ability scripted directly (docs/phase7-wave5.md). His identity (28001a/b,
 * `identity.js`), events (28003–28006, 28011–28014, 28026, `events.js`), supports/upgrades/allies (28002, 28007–
 * 28010, 28015–28020, 28027, `support-upgrades-allies.js` — Honed Technique 28017 is an engine gap, unscripted, see
 * that module's own docblock) and obligation/nemesis set (28021-28025, `obligation-nemesis.js`) are all scripted.
 */
export const NOVA_ABILITIES: AbilityRegistry = mergeRegistries(
  NOVA_IDENTITY,
  NOVA_EVENTS,
  NOVA_SUPPORT_UPGRADES_ALLIES,
  NOVA_OBLIGATION_NEMESIS,
);
