/**
 * Wave 1 (PLAN.md Phase 7 / docs/phase7-wave1.md): the Green Goblin (`gob`) and The Wrecking Crew (`twc`) scenario
 * packs, and the Captain America (`cap`), Ms. Marvel (`msm`), Thor (`thor`), Black Widow (`bkw`), Doctor Strange
 * (`drs`) and Hulk (`hlk`) hero packs.
 *
 * **Adding a pack is one line in `WAVE1_BUILTIN_PACKS`, plus that pack's own new files under `wave1/<pack>/`.** Each
 * pack owns its own folder (`wave1/cap/`, `wave1/gob/`, …) with its own `kit.ts` / `obligation.ts` / `nemesis.ts` /
 * scenario files, an `index.ts` exporting one `<PACK>_ABILITIES` registry, and a `pack.ts` defining the product as a
 * built-in pack from its `@mc/content` data and those abilities (see `wave1/cap/` for the shape). A pack
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
import type { BuiltinPack } from "../builtin-packs/define.js";
import { BKW_BUILTIN_PACK } from "./bkw/pack.js";
import { CAP_BUILTIN_PACK } from "./cap/pack.js";
import { DRS_BUILTIN_PACK } from "./drs/pack.js";
import { GOB_BUILTIN_PACK } from "./gob/pack.js";
import { HLK_BUILTIN_PACK } from "./hlk/pack.js";
import { MSM_BUILTIN_PACK } from "./msm/pack.js";
import { THOR_BUILTIN_PACK } from "./thor/pack.js";
import { TWC_BUILTIN_PACK } from "./twc/pack.js";
import { WAVE1_REPRINT_ABILITIES } from "./reprints.js";

/**
 * Wave 1's products as built-in packs (`../builtin-packs/define.ts`), in the order their scripts merge. Core is its own
 * pack (`CORE_BUILTIN_PACK`). Each pack carries the Core reprint aliases its cards use, so the packs together hold every
 * script the wave 1 pool needs.
 */
export const WAVE1_BUILTIN_PACKS: readonly BuiltinPack[] = [
  CAP_BUILTIN_PACK,
  THOR_BUILTIN_PACK,
  MSM_BUILTIN_PACK,
  HLK_BUILTIN_PACK,
  BKW_BUILTIN_PACK,
  DRS_BUILTIN_PACK,
  GOB_BUILTIN_PACK,
  TWC_BUILTIN_PACK,
];

/** A pack's own scripts: its abilities less the reprint aliases, which merge as one layer ahead of every pack. */
const ownScriptsOf = (pack: BuiltinPack): AbilityRegistry =>
  Object.fromEntries(Object.entries(pack.abilities).filter(([id]) => !Object.hasOwn(WAVE1_REPRINT_ABILITIES, id)));

/**
 * Every scripted ability in the wave 1 pool, keyed by `AbilityReference` id: Core's own scripts (`WAVE1_CARDS`
 * includes Core, and the engine skips an unregistered ability silently), Core reprints, then each pack's own. The
 * reprints merge as one layer, as they always have, so the registry's key order is unchanged.
 */
export const WAVE1_ABILITIES: AbilityRegistry = mergeRegistries(
  CORE_ABILITIES,
  WAVE1_REPRINT_ABILITIES,
  ...WAVE1_BUILTIN_PACKS.map(ownScriptsOf),
);

/** Engine dependencies for games that use the wave 1 pool (Core plus every wave 1 pack). */
export const WAVE1_DEPS: EngineDeps = { abilities: WAVE1_ABILITIES };

export { wave1ReprintAbilitiesOf, wave1ReprintPairs, WAVE1_REPRINT_ABILITIES } from "./reprints.js";
export { wave1StarterDeckSetup, wave1Scenario } from "./setup.js";
export type { Wave1ScenarioOptions } from "./setup.js";
