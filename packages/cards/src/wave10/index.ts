/**
 * Wave 10 (PLAN.md Phase 7 / docs/phase7-wave10.md): cycle 10, the Civil War box (`cw`, MC56: Tigra, Hulkling, four
 * leaders, sided modular sets), then the Wonder Man and Hercules hero packs.
 *
 * Synthezoid Smackdown (`synthezoid/`, MC57, cycle 10 after Civil War) has the same scaffold: one module per set, an empty
 * registry and every ref skipped ("wave 11 PR: synthezoid scripting in progress") until its scripting task lands.
 *
 * Every `cw` card belongs to one module file under `cw/` (see `card-groups.ts`); `modules.ts` lists them all. The
 * module files exist from the scaffold with an empty registry and every ref in its `_SKIPPED` map, so scripting a
 * module is editing that file and its test, nothing else. `setup.ts` builds any Civil War scenario (`wave10Scenario`);
 * `../playable/index.ts` routes a leader's id to it. `cw`, Wonder Man and Hercules are joined to the playable
 * pool (`../playable/index.ts`, `../modular-pool.ts`) and each of the four heroes has a starter deck
 * (`WAVE10_STARTER_DECKS`; Wonder Man's is the owner's stand-in listing, `verified: false`).
 */
import type { AbilityRegistry, EngineDeps } from "@mc/engine";
import { mergeRegistries } from "../dsl/index.js";
import { WAVE9_ABILITIES } from "../wave9/index.js";
import { WAVE10_MODULES } from "./modules.js";

/** Every scripted ability in the wave 10 pool: every earlier wave's script, then each wave 10 module's registry. */
export const WAVE10_ABILITIES: AbilityRegistry = mergeRegistries(
  WAVE9_ABILITIES,
  ...WAVE10_MODULES.map((module) => module.registry),
);

/** Engine dependencies for games that use the wave 10 (cycle 10) pool. */
export const WAVE10_DEPS: EngineDeps = { abilities: WAVE10_ABILITIES };

export { WAVE10_CARDS } from "./cards.js";
export { CARD_GROUPS } from "./card-groups.js";
export { WAVE10_MODULES } from "./modules.js";
export type { Wave10Module } from "./modules.js";
export {
  WAVE10_GAME_ENCOUNTER_SETS,
  wave10MainSchemeCard,
  wave10Scenario,
  wave10ScenarioRecord,
  wave10StarterDeckSetup,
} from "./setup.js";
export type { Wave10Difficulty, Wave10ScenarioOptions } from "./setup.js";
