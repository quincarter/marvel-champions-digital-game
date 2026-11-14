/**
 * Wave 6 (PLAN.md Phase 7 / docs/phase7-wave6.md): cycle 6, Mutant Genesis (`mut_gen`), the six X-Men hero packs and
 * MojoMania (`mojo`).
 *
 * **Adding a pack is one line in `WAVE6_BUILTIN_PACKS`, plus that pack's own files under `wave6/<pack>/`**, its
 * `pack.ts` (docs/builtin-content-packs.md §1.2) being its one entry point. Each pack's scripting status is in its
 * `pack.ts` doc comment. The wave has no reprint layer.
 */
import type { AbilityRegistry, EngineDeps } from "@mc/engine";
import type { BuiltinPack } from "../builtin-packs/define.js";
import { mergeRegistries } from "../dsl/index.js";
import { WAVE5_ABILITIES } from "../wave5/index.js";
import { CYCLOPS_BUILTIN_PACK } from "./cyclops/pack.js";
import { GAMBIT_BUILTIN_PACK } from "./gambit/pack.js";
import { MOJO_BUILTIN_PACK } from "./mojo/pack.js";
import { MUT_GEN_BUILTIN_PACK } from "./mut_gen/pack.js";
import { PHOENIX_BUILTIN_PACK } from "./phoenix/pack.js";
import { ROGUE_BUILTIN_PACK } from "./rogue/pack.js";
import { STORM_BUILTIN_PACK } from "./storm/pack.js";
import { WOLV_BUILTIN_PACK } from "./wolv/pack.js";

/** Wave 6's products as built-in packs (`../builtin-packs/define.ts`), in the order their scripts merge. */
export const WAVE6_BUILTIN_PACKS: readonly BuiltinPack[] = [
  MUT_GEN_BUILTIN_PACK,
  CYCLOPS_BUILTIN_PACK,
  PHOENIX_BUILTIN_PACK,
  WOLV_BUILTIN_PACK,
  STORM_BUILTIN_PACK,
  GAMBIT_BUILTIN_PACK,
  ROGUE_BUILTIN_PACK,
  MOJO_BUILTIN_PACK,
];

/** Every scripted ability in the wave 6 pool: every earlier wave's script, then each wave 6 pack's scripts. */
export const WAVE6_ABILITIES: AbilityRegistry = mergeRegistries(
  WAVE5_ABILITIES,
  ...WAVE6_BUILTIN_PACKS.map((pack) => pack.abilities),
);

/** Engine dependencies for games that use the wave 6 (cycle 6) pool. */
export const WAVE6_DEPS: EngineDeps = { abilities: WAVE6_ABILITIES };

export { wave6Scenario, wave6StarterDeckSetup } from "./setup.js";
export type { Wave6ScenarioOptions } from "./setup.js";
export { WAVE6_CARDS } from "./cards.js";
