/**
 * Wave 8 (PLAN.md Phase 7 / docs/phase7-wave8.md): cycle 8, Age of Apocalypse (`aoa`, Bishop and Magik with the
 * campaign box) and the four hero packs `iceman`, `jubilee`, `ncrawler` and `magneto`.
 *
 * Each product is a built-in pack (`<pack>/pack.ts`, `../builtin-packs/define.ts`) whose scripts are merged from
 * per-group modules (`<pack>/<hero>/{identity,events,support-upgrades-allies,obligation-nemesis}.ts`,
 * `<pack>/aspect-basic.ts`, and one module per scenario, modular and campaign-only encounter set). `card-groups.ts` maps
 * every module to its card ids. The wave has no reprint layer. The wave is joined to the playable pool
 * (`../playable/index.ts`, `../modular-pool.ts`): its heroes, scenarios and modular sets are chosen through
 * `playableScenario`. The campaign definition (`../campaigns/aoa.ts`) is registered in `CAMPAIGNS`
 * (`../campaigns/index.ts`).
 */
import type { AbilityRegistry, EngineDeps } from "@mc/engine";
import type { BuiltinPack } from "../builtin-packs/define.js";
import { mergeRegistries } from "../dsl/index.js";
import { WAVE7_ABILITIES } from "../wave7/index.js";
import { AOA_BUILTIN_PACK } from "./aoa/pack.js";
import { ICEMAN_BUILTIN_PACK } from "./iceman/pack.js";
import { JUBILEE_BUILTIN_PACK } from "./jubilee/pack.js";
import { MAGNETO_BUILTIN_PACK } from "./magneto/pack.js";
import { NCRAWLER_BUILTIN_PACK } from "./ncrawler/pack.js";

/** Wave 8's products as built-in packs (`../builtin-packs/define.ts`), in the order their scripts merge. */
export const WAVE8_BUILTIN_PACKS: readonly BuiltinPack[] = [
  AOA_BUILTIN_PACK,
  ICEMAN_BUILTIN_PACK,
  JUBILEE_BUILTIN_PACK,
  NCRAWLER_BUILTIN_PACK,
  MAGNETO_BUILTIN_PACK,
];

/**
 * Every scripted ability in the wave 8 pool: every earlier wave's script, then each wave 8 pack's scripts
 * (`WAVE8_BUILTIN_PACKS`; the wave has no reprint aliases to take out).
 */
export const WAVE8_ABILITIES: AbilityRegistry = mergeRegistries(
  WAVE7_ABILITIES,
  ...WAVE8_BUILTIN_PACKS.map((pack) => pack.abilities),
);

/** Engine dependencies for games that use the wave 8 (cycle 8) pool. */
export const WAVE8_DEPS: EngineDeps = { abilities: WAVE8_ABILITIES };

export { WAVE8_CARDS } from "./cards.js";
export { CARD_GROUPS } from "./card-groups.js";
export { wave8Scenario, wave8StarterDeckSetup } from "./setup.js";
export type { HorsemanSide, Wave8Difficulty, Wave8ScenarioOptions } from "./setup.js";
