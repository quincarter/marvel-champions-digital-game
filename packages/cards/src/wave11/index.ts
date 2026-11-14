/**
 * Wave 11 (PLAN.md Phase 7 / docs/phase7-wave11.md, docs/phase7-wave11-hero-packs.md): cycle 11, the Jessica Jones
 * (`jj`, MC61) and Luke Cage (`luke_cage`, MC62) hero packs, and Fear No Evil (`fne`, MC60), whose player half
 * (`fne/{daredevil,echo,aspect-basic}`) is scaffolded; its encounter cards get their modules later.
 *
 * Each hero pack's scripts live in per-group modules
 * (`<pack>/<hero>/{identity,events,support-upgrades-allies,obligation-nemesis}.ts`, then `<pack>/<aspect>.ts`);
 * `card-groups.ts` maps every module to its card ids and `modules.ts` lists them all. The module files exist from the
 * scaffold with an empty registry (reprints aliased to their originals) and every other ref in its `_SKIPPED` map, so
 * scripting a module is editing that file and its test, nothing else. Unscripted cards stay out of play through
 * `unscriptedCards` (`@mc/engine`), exactly as in earlier waves.
 *
 * Each product is a built-in pack (`<code>/pack.ts`, docs/builtin-content-packs.md §3.1) holding its modules'
 * registries; the wave's registry merges the packs in `WAVE11_BUILTIN_PACKS` order, which is the module list's order
 * (Shadowland's modules come first there).
 */
import type { AbilityRegistry, EngineDeps } from "@mc/engine";
import { mergeRegistries } from "../dsl/index.js";
import type { BuiltinPack } from "../builtin-packs/define.js";
import { WAVE10_ABILITIES } from "../wave10/index.js";
import { FNE_BUILTIN_PACK } from "./fne/pack.js";
import { JJ_BUILTIN_PACK } from "./jj/pack.js";
import { ELEKTRA_BUILTIN_PACK } from "./elektra/pack.js";
import { IRON_FIST_BUILTIN_PACK } from "./iron_fist/pack.js";
import { LUKE_CAGE_BUILTIN_PACK } from "./luke_cage/pack.js";
import { SHADOWLAND_BUILTIN_PACK } from "./shadowland/pack.js";

/**
 * Wave 11's products as built-in packs (`../builtin-packs/define.ts`), in the order their modules merge
 * (`WAVE11_MODULES` lists each product's modules together, in this order). Wave 11 has no reprint layer, so each
 * pack's abilities are its own scripts.
 */
export const WAVE11_BUILTIN_PACKS: readonly BuiltinPack[] = [
  SHADOWLAND_BUILTIN_PACK,
  JJ_BUILTIN_PACK,
  LUKE_CAGE_BUILTIN_PACK,
  FNE_BUILTIN_PACK,
  ELEKTRA_BUILTIN_PACK,
  IRON_FIST_BUILTIN_PACK,
];

/** Every scripted ability in the wave 11 pool: every earlier wave's script, then each wave 11 pack's scripts. */
export const WAVE11_ABILITIES: AbilityRegistry = mergeRegistries(
  WAVE10_ABILITIES,
  ...WAVE11_BUILTIN_PACKS.map((pack) => pack.abilities),
);

/** Engine dependencies for games that use the wave 11 (cycle 11) pool. */
export const WAVE11_DEPS: EngineDeps = { abilities: WAVE11_ABILITIES };

export { WAVE11_CARDS } from "./cards.js";
export { CARD_GROUPS, isFnePlayerHalfId } from "./card-groups.js";
export { WAVE11_MODULES, wave11ModulesOf } from "./modules.js";
export type { Wave11Module } from "./modules.js";
