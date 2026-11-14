/**
 * Wave 5 (PLAN.md Phase 7 / docs/phase7-wave5.md): cycle 4, the Sinister Motives products (`sm`, `nova`, `ironheart`,
 * `spiderham`, `spdr`), each defined as a built-in pack in its own `<product>/pack.ts` (docs/builtin-content-packs.md).
 * Cycle 4 has no reprint layer, so each pack's abilities are its own scripts.
 *
 * **Adding a product is its `pack.ts` plus one line in `WAVE5_BUILTIN_PACKS`** — mirrors `../wave4/index.ts`.
 */
import type { AbilityRegistry, EngineDeps } from "@mc/engine";
import type { BuiltinPack } from "../builtin-packs/define.js";
import { mergeRegistries } from "../dsl/index.js";
import { WAVE4_ABILITIES } from "../wave4/index.js";
import { IRONHEART_BUILTIN_PACK } from "./ironheart/pack.js";
import { NOVA_BUILTIN_PACK } from "./nova/pack.js";
import { SILK_QUICK_QUIP } from "./silk/quick-quip.js";
import { SM_BUILTIN_PACK } from "./sm/pack.js";
import { SPDR_BUILTIN_PACK } from "./spdr/pack.js";
import { SPIDERHAM_BUILTIN_PACK } from "./spiderham/pack.js";

/** Every wave 5 product as a built-in pack, in the order their scripts merge into `WAVE5_ABILITIES`. */
export const WAVE5_BUILTIN_PACKS: readonly BuiltinPack[] = [
  SM_BUILTIN_PACK,
  NOVA_BUILTIN_PACK,
  IRONHEART_BUILTIN_PACK,
  SPIDERHAM_BUILTIN_PACK,
  SPDR_BUILTIN_PACK,
];

/** Every scripted ability in the wave 5 pool: every earlier wave's own script, then each wave 5 pack's scripts. */
export const WAVE5_ABILITIES: AbilityRegistry = mergeRegistries(
  WAVE4_ABILITIES,
  ...WAVE5_BUILTIN_PACKS.map((pack) => pack.abilities),
  // Quick Quip (`silk` 52034) alone, ahead of its pack: Thwip Thwip!'s shape (`silk/quick-quip.ts`). It is a wave 9
  // card, so it is in no wave 5 pack.
  SILK_QUICK_QUIP,
);

/** Engine dependencies for games that use the wave 5 (cycle 4) pool. */
export const WAVE5_DEPS: EngineDeps = { abilities: WAVE5_ABILITIES };

export { wave5Scenario, wave5StarterDeckSetup } from "./setup.js";
export type { Wave5ScenarioOptions } from "./setup.js";
export { WAVE5_CARDS } from "./cards.js";
