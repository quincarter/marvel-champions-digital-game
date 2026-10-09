/**
 * Wave 8 (PLAN.md Phase 7 / docs/phase7-wave8.md): cycle 8, Age of Apocalypse (`aoa`, Bishop and Magik with the
 * campaign box) and the four hero packs `iceman`, `jubilee`, `ncrawler` and `magneto`.
 *
 * Each pack's registry is merged from per-group modules
 * (`<pack>/<hero>/{identity,events,support-upgrades-allies,obligation-nemesis}.ts`, `<pack>/aspect-basic.ts`, and one
 * module per scenario, modular and campaign-only encounter set). `card-groups.ts` maps every module to its card ids.
 * The wave is joined to the playable pool (`../playable/index.ts`, `../modular-pool.ts`): its heroes, scenarios and
 * modular sets are chosen through `playableScenario`. The campaign definition (`../campaigns/aoa.ts`) is registered in `CAMPAIGNS` (`../campaigns/index.ts`).
 */
import type { AbilityRegistry, EngineDeps } from "@mc/engine";
import { mergeRegistries } from "../dsl/index.js";
import { WAVE7_ABILITIES } from "../wave7/index.js";
import { AOA_ABILITIES } from "./aoa/index.js";
import { ICEMAN_ABILITIES } from "./iceman/index.js";
import { JUBILEE_ABILITIES } from "./jubilee/index.js";
import { MAGNETO_ABILITIES } from "./magneto/index.js";
import { NCRAWLER_ABILITIES } from "./ncrawler/index.js";

/** Every scripted ability in the wave 8 pool: every earlier wave's script, then one entry per wave 8 pack started. */
export const WAVE8_ABILITIES: AbilityRegistry = mergeRegistries(
  WAVE7_ABILITIES,
  AOA_ABILITIES,
  ICEMAN_ABILITIES,
  JUBILEE_ABILITIES,
  NCRAWLER_ABILITIES,
  MAGNETO_ABILITIES,
);

/** Engine dependencies for games that use the wave 8 (cycle 8) pool. */
export const WAVE8_DEPS: EngineDeps = { abilities: WAVE8_ABILITIES };

export { WAVE8_CARDS } from "./cards.js";
export { CARD_GROUPS } from "./card-groups.js";
export { wave8Scenario, wave8StarterDeckSetup } from "./setup.js";
export type { HorsemanSide, Wave8Difficulty, Wave8ScenarioOptions } from "./setup.js";
