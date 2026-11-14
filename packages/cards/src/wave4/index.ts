/**
 * Wave 4 (PLAN.md Phase 7 / docs/phase7-wave4.md): cycle 3, the Mad Titan's Shadow products (`nebu`, `warm`,
 * `vision`, `mts`, `valk`, `hood`), each defined as a built-in pack in its own `<product>/pack.ts`
 * (docs/builtin-content-packs.md).
 *
 * **Adding a product is its `pack.ts` plus one line in `WAVE4_BUILTIN_PACKS`** (and its ability modules in
 * `./reprints.ts`'s `PACK_OWN_ABILITIES`) — mirrors `../wave3/index.ts`.
 */
import type { AbilityRegistry, EngineDeps } from "@mc/engine";
import { ownScriptsOf, type BuiltinPack } from "../builtin-packs/define.js";
import { mergeRegistries } from "../dsl/index.js";
import { WAVE3_ABILITIES } from "../wave3/index.js";
import { HOOD_BUILTIN_PACK } from "./hood/pack.js";
import { MTS_BUILTIN_PACK } from "./mts/pack.js";
import { NEBU_BUILTIN_PACK } from "./nebu/pack.js";
import { VALK_BUILTIN_PACK } from "./valk/pack.js";
import { VISION_BUILTIN_PACK } from "./vision/pack.js";
import { WARM_BUILTIN_PACK } from "./warm/pack.js";
import { WAVE4_REPRINT_ABILITIES } from "./reprints.js";

/** Every wave 4 product as a built-in pack, in the order their scripts merge into `WAVE4_ABILITIES`. */
export const WAVE4_BUILTIN_PACKS: readonly BuiltinPack[] = [
  NEBU_BUILTIN_PACK,
  WARM_BUILTIN_PACK,
  VISION_BUILTIN_PACK,
  MTS_BUILTIN_PACK,
  VALK_BUILTIN_PACK,
  HOOD_BUILTIN_PACK,
];

/** Every scripted ability in the wave 4 pool: every earlier (Core/wave 1/cycle 1/cycle 2) script, wave 4's own reprint
 * aliases, then each wave 4 pack's own scripts (the aliases taken back out, since they merge once, ahead of them). */
export const WAVE4_ABILITIES: AbilityRegistry = mergeRegistries(
  WAVE3_ABILITIES,
  WAVE4_REPRINT_ABILITIES,
  ...WAVE4_BUILTIN_PACKS.map((pack) => ownScriptsOf(pack, WAVE4_REPRINT_ABILITIES)),
);

/** Engine dependencies for games that use the wave 4 (cycle 3) pool. */
export const WAVE4_DEPS: EngineDeps = { abilities: WAVE4_ABILITIES };

export { wave4ReprintPairs, WAVE4_REPRINT_ABILITIES, WAVE4_REPRINT_PROBLEMS } from "./reprints.js";
export { wave4Scenario, wave4StarterDeckSetup } from "./setup.js";
export type { Wave4ScenarioOptions } from "./setup.js";
export { WAVE4_CARDS } from "./cards.js";
