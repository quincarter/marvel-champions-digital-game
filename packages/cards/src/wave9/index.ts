/**
 * Wave 9 (PLAN.md Phase 7 / docs/phase7-wave9.md): cycle 9, Agents of S.H.I.E.L.D. (`aos`, Maria Hill and Nick Fury with
 * the campaign box), the four hero packs `bp` (Black Panther), `silk`, `falcon` and `winter` (Winter Soldier), and
 * Trickster Takeover (`tt`).
 *
 * Each pack's registry is merged from per-group modules
 * (`<pack>/<hero>/{identity,events,support-upgrades-allies,obligation-nemesis}.ts`, `<pack>/aspect-basic.ts`, and one
 * module per scenario and modular encounter set). `card-groups.ts` maps every module to its card ids. At the scaffold
 * every module is empty and the wave is NOT joined to the playable pool (`../playable/index.ts`, `../modular-pool.ts`).
 */
import type { AbilityRegistry, EngineDeps } from "@mc/engine";
import { mergeRegistries } from "../dsl/index.js";
import { WAVE8_ABILITIES } from "../wave8/index.js";
import { AOS_ABILITIES } from "./aos/index.js";
import { BP_ABILITIES } from "./bp/index.js";
import { FALCON_ABILITIES } from "./falcon/index.js";
import { SILK_ABILITIES } from "./silk/index.js";
import { TT_ABILITIES } from "./tt/index.js";
import { WINTER_ABILITIES } from "./winter/index.js";

/** Every scripted ability in the wave 9 pool: every earlier wave's script, then one entry per wave 9 pack started. */
export const WAVE9_ABILITIES: AbilityRegistry = mergeRegistries(
  WAVE8_ABILITIES,
  AOS_ABILITIES,
  BP_ABILITIES,
  SILK_ABILITIES,
  FALCON_ABILITIES,
  WINTER_ABILITIES,
  TT_ABILITIES,
);

/** Engine dependencies for games that use the wave 9 (cycle 9) pool. */
export const WAVE9_DEPS: EngineDeps = { abilities: WAVE9_ABILITIES };

export { WAVE9_CARDS } from "./cards.js";
export { CARD_GROUPS } from "./card-groups.js";
export { wave9Scenario, wave9StarterDeckSetup } from "./setup.js";
export type { Wave9Difficulty, Wave9ScenarioOptions } from "./setup.js";
