/**
 * The one card pool this app runs: Core plus wave 1 (PLAN.md Phase 7). Every
 * scene, the deck screens and the engine worker read the app's pool from here
 * — never from `@mc/content`'s `CORE_*` exports or `@mc/cards`' `CORE_DEPS`
 * directly — so the client can only ever run one pool at a time and adding a
 * later wave is a one-file change.
 *
 * `wave1Scenario` (not `coreScenario`) is the app's scenario builder: it
 * already falls through to `coreScenario` for a Core scenario id, so every
 * existing Core game is unaffected, and it is the only builder that also
 * knows Risky Business, Mutagen Formula and Breakout.
 */
import { WAVE1_DEPS, wave1Scenario, type Wave1ScenarioOptions } from "@mc/cards";
import {
  BKW_PACK,
  CAP_PACK,
  CORE_ENCOUNTER_SETS,
  CORE_PACK,
  CORE_SCENARIOS,
  CORE_STARTER_DECKS,
  DRS_PACK,
  GOB_PACK,
  HLK_PACK,
  MSM_PACK,
  THOR_PACK,
  TWC_PACK,
  WAVE1_ENCOUNTER_SETS,
  WAVE1_SCENARIOS,
  WAVE1_STARTER_DECKS,
  poolVersionOf,
  type AnyCard,
  type EncounterSet,
  type Pack,
  type Scenario,
  type StarterDeck,
} from "@mc/content";
import type { EngineDeps } from "@mc/engine";
import { POOL_CARDS } from "./pool-cards.js";

// Defined in `pool-cards.ts` so the build can read it without the rules engine; re-exported so this stays the one import site.
export { POOL_CARDS };

/** Every card in `POOL_CARDS`, by id — the one lookup every setup screen needs (a scenario's villain/main scheme, a deck's identity, a seat's hero). Built once, from the pool alone, so no screen keeps its own copy. */
export const CARDS_BY_ID: ReadonlyMap<string, AnyCard> = new Map(POOL_CARDS.map((card) => [card.id as string, card]));

/** Every encounter set the app's pool knows (Core's plus every wave 1 pack's), for a screen that names one (a scenario's own sets, a modular set picker, an encounter deck preview). `WAVE1_ENCOUNTER_SETS` deliberately excludes Core's own sets (`@mc/content`'s own doc comment), so both are combined here. */
export const POOL_ENCOUNTER_SETS: readonly EncounterSet[] = [...CORE_ENCOUNTER_SETS, ...WAVE1_ENCOUNTER_SETS];

/**
 * The five Core modular encounter sets a table setup may pick between
 * (docs/phase4-screen-gaps.md §5): every other Core encounter set is a
 * villain's own set, a nemesis set, or a difficulty set (Standard/Expert), not
 * a modular a scenario picks at setup. Wave 1's own scenarios (Green Goblin's
 * Risky Business/Mutagen Formula) each recommend a set of their own
 * ("power_drain", "goblin_gimmicks") that isn't one of these five — those stay
 * pickable too, via `view/modular-sets.ts`'s `modularSetCandidatesFor`, which
 * adds a scenario's own recommended set(s) to this fixed list rather than
 * replacing it.
 */
export const CORE_MODULAR_SET_IDS: readonly string[] = [
  "bomb_scare",
  "masters_of_evil",
  "under_attack",
  "legions_of_hydra",
  "the_doomsday_chair",
];

/** Every ability script for `POOL_CARDS` (Core's own scripts included — `WAVE1_DEPS` starts from `CORE_ABILITIES`). */
export const POOL_DEPS: EngineDeps = WAVE1_DEPS;

/** Every scenario, Core first (Rhino, Klaw, Ultron), then wave 1 (Risky Business, Mutagen Formula, Breakout). */
export const POOL_SCENARIOS: readonly Scenario[] = [...CORE_SCENARIOS, ...WAVE1_SCENARIOS];

/** Every starter deck, Core's six precons first, then the six wave 1 hero packs'. */
export const POOL_STARTER_DECKS: readonly StarterDeck[] = [...CORE_STARTER_DECKS, ...WAVE1_STARTER_DECKS];

/** This build's pool version — bumps whenever `POOL_CARDS` changes shape, which retires an older save/deck against it. */
export const POOL_VERSION: string = poolVersionOf(POOL_CARDS);

/**
 * Every physical product's own display name, by `Pack.code` (`Scenario.packCode`) — Core plus all eight wave 1
 * packs, not only the two that define a scenario today, so a Title row naming a future scenario pack's own product
 * doesn't need this list touched again. `@mc/content` has no aggregated "every pack" export yet (PLAN.md Phase 7:
 * each pack module exports its own `*_PACK` constant), so this is that aggregate, scoped to what the app's pool
 * actually knows.
 */
export const POOL_PACKS: readonly Pack[] = [CORE_PACK, GOB_PACK, TWC_PACK, CAP_PACK, MSM_PACK, THOR_PACK, BKW_PACK, DRS_PACK, HLK_PACK];

/** A pack's own display name ("The Wrecking Crew") by its code ("twc"), falling back to the code itself if the pool ever names one this list doesn't have. */
export function packNameOf(code: string): string {
  return POOL_PACKS.find((pack) => (pack.code as string) === code)?.name ?? code;
}

/** The app's one scenario builder: Core scenarios and wave 1 scenarios alike. */
export const buildScenario = wave1Scenario;

export type { Wave1ScenarioOptions };
