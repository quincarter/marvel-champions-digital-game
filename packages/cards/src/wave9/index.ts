/**
 * Wave 9 (PLAN.md Phase 7 / docs/phase7-wave9.md): cycle 9, Agents of S.H.I.E.L.D. (`aos`, Maria Hill and Nick Fury with
 * the campaign box), the four hero packs `bp` (Black Panther), `silk`, `falcon` and `winter` (Winter Soldier), and
 * Trickster Takeover (`tt`).
 *
 * Each product is a built-in pack (`<pack>/pack.ts`, `../builtin-packs/define.ts`) whose scripts are merged from
 * per-group modules (`<pack>/<hero>/{identity,events,support-upgrades-allies,obligation-nemesis}.ts`,
 * `<pack>/aspect-basic.ts`, and one module per scenario and modular encounter set). `card-groups.ts` maps every module
 * to its card ids. The wave has no reprint layer. Silk's Quick Quip (52034) was scripted in wave 5 and merges there;
 * the `silk` pack holds it too, so wave 9 merges that pack less that script.
 */
import type { AbilityRegistry, EngineDeps } from "@mc/engine";
import { ownScriptsOf, type BuiltinPack } from "../builtin-packs/define.js";
import { mergeRegistries } from "../dsl/index.js";
import { SILK_QUICK_QUIP } from "../wave5/silk/quick-quip.js";
import { WAVE8_ABILITIES } from "../wave8/index.js";
import { AOS_BUILTIN_PACK } from "./aos/pack.js";
import { BP_BUILTIN_PACK } from "./bp/pack.js";
import { FALCON_BUILTIN_PACK } from "./falcon/pack.js";
import { SILK_BUILTIN_PACK } from "./silk/pack.js";
import { TT_BUILTIN_PACK } from "./tt/pack.js";
import { WINTER_BUILTIN_PACK } from "./winter/pack.js";

/** Wave 9's products as built-in packs (`../builtin-packs/define.ts`), in the order their scripts merge. */
export const WAVE9_BUILTIN_PACKS: readonly BuiltinPack[] = [
  AOS_BUILTIN_PACK,
  BP_BUILTIN_PACK,
  SILK_BUILTIN_PACK,
  FALCON_BUILTIN_PACK,
  WINTER_BUILTIN_PACK,
  TT_BUILTIN_PACK,
];

/**
 * Every scripted ability in the wave 9 pool: every earlier wave's script, then each wave 9 pack's scripts
 * (`WAVE9_BUILTIN_PACKS`). The `silk` pack's Quick Quip (`SILK_QUICK_QUIP`) already merged in wave 5, so it is taken
 * out of that pack here, the way a wave's reprint aliases are (`ownScriptsOf`).
 */
export const WAVE9_ABILITIES: AbilityRegistry = mergeRegistries(
  WAVE8_ABILITIES,
  ...WAVE9_BUILTIN_PACKS.map((pack) =>
    pack === SILK_BUILTIN_PACK ? ownScriptsOf(pack, SILK_QUICK_QUIP) : pack.abilities,
  ),
);

/** Engine dependencies for games that use the wave 9 (cycle 9) pool. */
export const WAVE9_DEPS: EngineDeps = { abilities: WAVE9_ABILITIES };

export { WAVE9_CARDS } from "./cards.js";
export { CARD_GROUPS } from "./card-groups.js";
export { wave9Scenario, wave9StarterDeckSetup } from "./setup.js";
export type { Wave9Difficulty, Wave9ScenarioOptions } from "./setup.js";
