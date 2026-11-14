/**
 * Wave 7 (PLAN.md Phase 7 / docs/phase7-wave7.md): cycle 7, NeXt Evolution (`next_evol`, Cable and Domino with the
 * five-scenario campaign box) and the four hero packs `psylocke`, `angel`, `x23` and `deadpool`.
 *
 * Every pack is scripted (each pack's `pack.ts` merges its per-group modules, one module per scenario and modular set,
 * so parallel scripting agents never share a file) and the wave is joined to `playable/` (`PLAYABLE_ABILITIES`,
 * `playableScenario`, `playableStarterDeckSetup`). The wave has no reprint layer.
 */
import type { AbilityRegistry, EngineDeps } from "@mc/engine";
import type { BuiltinPack } from "../builtin-packs/define.js";
import { mergeRegistries } from "../dsl/index.js";
import { WAVE6_ABILITIES } from "../wave6/index.js";
import { ANGEL_BUILTIN_PACK } from "./angel/pack.js";
import { DEADPOOL_BUILTIN_PACK } from "./deadpool/pack.js";
import { NEXT_EVOL_BUILTIN_PACK } from "./next_evol/pack.js";
import { PSYLOCKE_BUILTIN_PACK } from "./psylocke/pack.js";
import { X23_BUILTIN_PACK } from "./x23/pack.js";

/** Wave 7's products as built-in packs (`../builtin-packs/define.ts`), in the order their scripts merge. */
export const WAVE7_BUILTIN_PACKS: readonly BuiltinPack[] = [
  NEXT_EVOL_BUILTIN_PACK,
  PSYLOCKE_BUILTIN_PACK,
  ANGEL_BUILTIN_PACK,
  X23_BUILTIN_PACK,
  DEADPOOL_BUILTIN_PACK,
];

/** Every scripted ability in the wave 7 pool: every earlier wave's script, then each wave 7 pack's scripts. */
export const WAVE7_ABILITIES: AbilityRegistry = mergeRegistries(
  WAVE6_ABILITIES,
  ...WAVE7_BUILTIN_PACKS.map((pack) => pack.abilities),
);

/** Engine dependencies for games that use the wave 7 (cycle 7) pool. */
export const WAVE7_DEPS: EngineDeps = { abilities: WAVE7_ABILITIES };

export { wave7Scenario, wave7StarterDeckSetup } from "./setup.js";
export type { Wave7ScenarioOptions } from "./setup.js";
export { WAVE7_CARDS } from "./cards.js";
