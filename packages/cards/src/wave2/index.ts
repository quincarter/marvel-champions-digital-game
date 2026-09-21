/**
 * Wave 2 (PLAN.md Phase 7 / docs/phase7-wave2.md / docs/phase7-wave2-scripting.md): cycle 1. The Rise of Red Skull
 * (`trors`: Hawkeye, Spider-Woman, and five scenarios), The Once and Future Kang (`toafk`), and the Ant-Man
 * (`ant`), Wasp (`wsp`), Quicksilver (`qsv`) and Scarlet Witch (`scw`) hero packs, in release order.
 *
 * **Adding a pack is one line here, plus that pack's own new files under `wave2/<pack>/`.** Each pack owns its own
 * folder (`wave2/trors/`, …) with its own kit/obligation/nemesis/scenario modules and its own `index.ts` exporting
 * one `<PACK>_ABILITIES` registry (see `wave2/trors/index.ts` for the shape, itself modeled on
 * `wave1/cap/index.ts`). A pack agent never edits another pack's folder, `reprints.ts`, `names.ts`, or this file's
 * registry list beyond adding their own one line — see `docs/phase7-wave2-scripting.md` for the full brief.
 *
 * Reprints (a wave 2 card that is the identical Core or wave 1 card by name and type) are aliased automatically by
 * `reprints.ts`, merged in ahead of every pack: a pack's own module must never define an ability id `reprints.ts`
 * already supplies — `mergeRegistries` throws "defined twice" if it does, which is the intended guard rail.
 */
import type { AbilityRegistry, EngineDeps } from "@mc/engine";
import { CORE_ABILITIES } from "../core/index.js";
import { mergeRegistries } from "../dsl/index.js";
import { TRORS_ABILITIES } from "./trors/index.js";
import { WAVE2_REPRINT_ABILITIES } from "./reprints.js";
import { TOAFK_ABILITIES } from "./toafk/index.js";
import { ANT_ABILITIES } from "./ant/index.js";
import { WSP_ABILITIES } from "./wsp/index.js";
import { QSV_ABILITIES } from "./qsv/index.js";
import { SCW_ABILITIES } from "./scw/index.js";

/**
 * Every scripted ability in the wave 2 pool, keyed by `AbilityReference` id: Core's own scripts (`WAVE2_CARDS`
 * includes Core, and the engine skips an unregistered ability silently), Core/wave 1 reprints, then one entry per
 * cycle 1 pack.
 */
export const WAVE2_ABILITIES: AbilityRegistry = mergeRegistries(
  CORE_ABILITIES,
  WAVE2_REPRINT_ABILITIES,
  TRORS_ABILITIES,
  TOAFK_ABILITIES,
  ANT_ABILITIES,
  WSP_ABILITIES,
  QSV_ABILITIES,
  SCW_ABILITIES,
);

/** Engine dependencies for games that use the wave 2 (cycle 1) pool (Core plus every scripted cycle 1 pack). */
export const WAVE2_DEPS: EngineDeps = { abilities: WAVE2_ABILITIES };

export { wave2ReprintPairs, WAVE2_REPRINT_ABILITIES, WAVE2_REPRINT_PROBLEMS } from "./reprints.js";
export { wave2StarterDeckSetup, wave2Scenario } from "./setup.js";
export type { Wave2ScenarioOptions } from "./setup.js";
