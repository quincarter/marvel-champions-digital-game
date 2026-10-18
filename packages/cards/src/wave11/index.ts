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
 */
import type { AbilityRegistry, EngineDeps } from "@mc/engine";
import { mergeRegistries } from "../dsl/index.js";
import { WAVE10_ABILITIES } from "../wave10/index.js";
import { WAVE11_MODULES } from "./modules.js";

/** Every scripted ability in the wave 11 pool: every earlier wave's script, then each wave 11 module's registry. */
export const WAVE11_ABILITIES: AbilityRegistry = mergeRegistries(
  WAVE10_ABILITIES,
  ...WAVE11_MODULES.map((module) => module.registry),
);

/** Engine dependencies for games that use the wave 11 (cycle 11) pool. */
export const WAVE11_DEPS: EngineDeps = { abilities: WAVE11_ABILITIES };

export { WAVE11_CARDS } from "./cards.js";
export { CARD_GROUPS, isFnePlayerHalfId } from "./card-groups.js";
export { WAVE11_MODULES } from "./modules.js";
export type { Wave11Module } from "./modules.js";
