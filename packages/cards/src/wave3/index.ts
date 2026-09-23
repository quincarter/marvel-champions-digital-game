/**
 * Wave 3 (PLAN.md Phase 7 / docs/phase7-wave3.md / docs/phase7-wave3-scripting.md): cycle 2, The Galaxy's Most
 * Wanted (`gmw`: Groot, Rocket Raccoon, and five scenarios), plus the Star-Lord (`stld`), Gamora (`gam`), Drax
 * (`drax`) and Venom (`vnm`) hero packs and the Kree Fanatic modular set (`ron`), in release order.
 *
 * **Adding a pack is one line here, plus that pack's own new files under `wave3/<pack>/`** — mirrors
 * `../wave2/index.ts` exactly; see that file's docblock and docs/phase7-wave3-scripting.md for the full brief.
 *
 * Reprints are aliased automatically by `reprints.ts`, merged in ahead of every pack: a pack's own module must
 * never define an ability id `reprints.ts` already supplies.
 */
import type { AbilityRegistry, EngineDeps } from "@mc/engine";
import { WAVE1_ABILITIES } from "../wave1/index.js";
import { WAVE2_ABILITIES } from "../wave2/index.js";
import { mergeRegistries } from "../dsl/index.js";
import { GAM_ABILITIES } from "./gam/index.js";
import { GMW_ABILITIES } from "./gmw/index.js";
import { STLD_ABILITIES } from "./stld/index.js";
import { WAVE3_REPRINT_ABILITIES } from "./reprints.js";

/**
 * Every earlier ability definition: Core + wave 1 + cycle 1. `WAVE1_ABILITIES`/`WAVE2_ABILITIES` are siblings, not
 * nested (`./cards.ts`'s docblock), and both carry `CORE_ABILITIES`'s own ids with the same definition objects, so
 * a plain spread — not `mergeRegistries`, whose throw-on-duplicate guard is for genuinely new ids within one wave
 * — is correct here (`./reprints.ts`'s own `EARLIER_ABILITIES` is the same shape).
 */
const EARLIER_ABILITIES: AbilityRegistry = { ...WAVE1_ABILITIES, ...WAVE2_ABILITIES };

/**
 * Every scripted ability in the wave 3 pool: every earlier (Core/wave 1/cycle 1) script, wave 3's own reprint
 * aliases, then one entry per cycle 2 pack that has been started (`gmw`, `gam`, `stld`).
 */
export const WAVE3_ABILITIES: AbilityRegistry = mergeRegistries(
  EARLIER_ABILITIES,
  WAVE3_REPRINT_ABILITIES,
  GMW_ABILITIES,
  GAM_ABILITIES,
  STLD_ABILITIES,
);

/** Engine dependencies for games that use the wave 3 (cycle 2) pool. */
export const WAVE3_DEPS: EngineDeps = { abilities: WAVE3_ABILITIES };

export { wave3ReprintPairs, WAVE3_REPRINT_ABILITIES, WAVE3_REPRINT_PROBLEMS } from "./reprints.js";
export { wave3Scenario, wave3StarterDeckSetup } from "./setup.js";
export type { Wave3ScenarioOptions } from "./setup.js";
export { WAVE3_CARDS } from "./cards.js";
