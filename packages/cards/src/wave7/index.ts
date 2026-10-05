/**
 * Wave 7 (PLAN.md Phase 7 / docs/phase7-wave7.md): cycle 7, NeXt Evolution (`next_evol`, Cable and Domino with the
 * five-scenario campaign box) and the four hero packs `psylocke`, `angel`, `x23` and `deadpool`.
 *
 * **Scaffold only: no wave 7 card is scripted.** Each pack's registry is merged from empty per-group modules
 * (`<pack>/<hero>/{identity,events,support-upgrades-allies,obligation-nemesis}.ts`, one module per scenario and
 * modular set), so parallel scripting agents never share a file. Scripting a group is filling its module; nothing here
 * changes. The wave is not joined to `playable/`: the five packs stay in the legality test's `UNSCRIPTED_WAVE7_PACKS`
 * and `wave7Scenario` is not offered to the client until the packs are scripted (the client's `pool.ts` is a later step).
 */
import type { AbilityRegistry, EngineDeps } from "@mc/engine";
import { mergeRegistries } from "../dsl/index.js";
import { WAVE6_ABILITIES } from "../wave6/index.js";
import { ANGEL_ABILITIES } from "./angel/index.js";
import { DEADPOOL_ABILITIES } from "./deadpool/index.js";
import { NEXT_EVOL_ABILITIES } from "./next_evol/index.js";
import { PSYLOCKE_ABILITIES } from "./psylocke/index.js";
import { X23_ABILITIES } from "./x23/index.js";

/** Every scripted ability in the wave 7 pool: every earlier wave's script, then one entry per wave 7 pack started. */
export const WAVE7_ABILITIES: AbilityRegistry = mergeRegistries(
  WAVE6_ABILITIES,
  NEXT_EVOL_ABILITIES,
  PSYLOCKE_ABILITIES,
  ANGEL_ABILITIES,
  X23_ABILITIES,
  DEADPOOL_ABILITIES,
);

/** Engine dependencies for games that use the wave 7 (cycle 7) pool. */
export const WAVE7_DEPS: EngineDeps = { abilities: WAVE7_ABILITIES };

export { wave7Scenario, wave7StarterDeckSetup } from "./setup.js";
export type { Wave7ScenarioOptions } from "./setup.js";
export { WAVE7_CARDS } from "./cards.js";
