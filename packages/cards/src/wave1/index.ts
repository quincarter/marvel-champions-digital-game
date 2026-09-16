/**
 * Wave 1 (PLAN.md Phase 7 / docs/phase7-wave1.md): the Green Goblin (`gob`) and The Wrecking Crew (`twc`) scenario
 * packs, and the Captain America (`cap`), Ms. Marvel (`msm`), Thor (`thor`), Black Widow (`bkw`), Doctor Strange
 * (`drs`) and Hulk (`hlk`) hero packs.
 *
 * **Adding a pack is one line here, plus that pack's own new files under `wave1/<pack>/`.** Each pack owns its own
 * folder (`wave1/cap/`, `wave1/gob/`, …) with its own `kit.ts` / `obligation.ts` / `nemesis.ts` / scenario files and
 * its own `index.ts` exporting one `<PACK>_ABILITIES` registry (see `wave1/cap/index.ts` for the shape). A pack
 * agent never edits another pack's folder, `reprints.ts`, `names.ts`, or this file's registry list beyond adding
 * their own one line — see `docs/phase7-wave1-scripting.md` for the full brief every pack agent works from.
 *
 * Reprints (a wave 1 card that is the identical Core card by name and type) are aliased automatically by
 * `reprints.ts`, merged in ahead of every pack: a pack's own module must never define an ability id `reprints.ts`
 * already supplies — `mergeRegistries` throws "defined twice" if it does, which is the intended guard rail.
 */
import type { AbilityRegistry, EngineDeps } from "@mc/engine";
import { CORE_ABILITIES } from "../core/index.js";
import { mergeRegistries } from "../dsl/index.js";
import { BKW_ABILITIES } from "./bkw/index.js";
import { CAP_ABILITIES } from "./cap/index.js";
import { DRS_ABILITIES } from "./drs/index.js";
import { GOB_ABILITIES } from "./gob/index.js";
import { HLK_ABILITIES } from "./hlk/index.js";
import { MSM_ABILITIES } from "./msm/index.js";
import { THOR_ABILITIES } from "./thor/index.js";
import { TWC_ABILITIES } from "./twc/index.js";
import { WAVE1_REPRINT_ABILITIES } from "./reprints.js";

/**
 * Every scripted ability in the wave 1 pool, keyed by `AbilityReference` id: Core's own scripts (`WAVE1_CARDS`
 * includes Core, and the engine skips an unregistered ability silently), Core reprints, then one entry per pack.
 */
export const WAVE1_ABILITIES: AbilityRegistry = mergeRegistries(
  CORE_ABILITIES,
  WAVE1_REPRINT_ABILITIES,
  CAP_ABILITIES,
  THOR_ABILITIES,
  MSM_ABILITIES,
  HLK_ABILITIES,
  BKW_ABILITIES,
  DRS_ABILITIES,
  GOB_ABILITIES,
  TWC_ABILITIES,
);

/** Engine dependencies for games that use the wave 1 pool (Core plus every wave 1 pack). */
export const WAVE1_DEPS: EngineDeps = { abilities: WAVE1_ABILITIES };

export { wave1ReprintPairs, WAVE1_REPRINT_ABILITIES } from "./reprints.js";
export { wave1StarterDeckSetup, wave1Scenario } from "./setup.js";
export type { Wave1ScenarioOptions } from "./setup.js";
