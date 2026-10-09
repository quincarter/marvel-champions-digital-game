/**
 * The one card pool this app runs: Core, wave 1, cycle 1, cycle 2, cycle 3, cycle 4 and cycle 6 (Mutant Genesis)'s shipped-so-far packs
 * (PLAN.md Phase 7). Every scene, the deck screens and the engine worker read the app's pool from here
 * — never from `@mc/content`'s `CORE_*` exports or `@mc/cards`' `CORE_DEPS`
 * directly — so the client can only ever run one pool at a time and adding a
 * later wave is a one-file change.
 *
 * `playableScenario` is the app's scenario builder: it hands a scenario to
 * its own wave's builder (Core's, wave 1's, cycle 1's, cycle 2's, cycle 3's or cycle 4's) and widens the game's
 * card pool to every playable card, so any deck can sit at any scenario.
 */
import { PLAYABLE_DEPS, playableScenario, type PlayableScenarioOptions } from "@mc/cards";
import {
  BKW_CYCLE,
  BKW_PACK,
  ANT_CYCLE,
  ANT_PACK,
  CAP_CYCLE,
  CAP_PACK,
  CORE_CYCLE,
  CORE_ENCOUNTER_SETS,
  CORE_PACK,
  CORE_SCENARIOS,
  CORE_STARTER_DECKS,
  DRAX_CYCLE,
  DRAX_PACK,
  DRS_CYCLE,
  DRS_PACK,
  GAM_CYCLE,
  GAM_PACK,
  GMW_CYCLE,
  GMW_PACK,
  GOB_CYCLE,
  GOB_PACK,
  HLK_CYCLE,
  HLK_PACK,
  HOOD_CYCLE,
  HOOD_PACK,
  IRONHEART_CYCLE,
  IRONHEART_PACK,
  MUT_GEN_CYCLE,
  MUT_GEN_PACK,
  CYCLOPS_CYCLE,
  CYCLOPS_PACK,
  PHOENIX_CYCLE,
  PHOENIX_PACK,
  WOLV_CYCLE,
  WOLV_PACK,
  STORM_CYCLE,
  STORM_PACK,
  MOJO_CYCLE,
  MOJO_PACK,
  GAMBIT_CYCLE,
  GAMBIT_PACK,
  ROGUE_CYCLE,
  ROGUE_PACK,
  NEXT_EVOL_CYCLE,
  NEXT_EVOL_PACK,
  PSYLOCKE_CYCLE,
  PSYLOCKE_PACK,
  ANGEL_CYCLE,
  ANGEL_PACK,
  X23_CYCLE,
  X23_PACK,
  DEADPOOL_CYCLE,
  DEADPOOL_PACK,
  MSM_CYCLE,
  MSM_PACK,
  MTS_CYCLE,
  MTS_PACK,
  NEBU_CYCLE,
  NEBU_PACK,
  NOVA_CYCLE,
  NOVA_PACK,
  QSV_CYCLE,
  QSV_PACK,
  RON_CYCLE,
  RON_PACK,
  SCW_CYCLE,
  SCW_PACK,
  SM_CYCLE,
  SM_PACK,
  SPDR_CYCLE,
  SPDR_PACK,
  SPIDERHAM_CYCLE,
  SPIDERHAM_PACK,
  STLD_CYCLE,
  STLD_PACK,
  THOR_CYCLE,
  THOR_PACK,
  TOAFK_CYCLE,
  TOAFK_PACK,
  TRORS_CYCLE,
  TRORS_PACK,
  TWC_CYCLE,
  TWC_PACK,
  VALK_CYCLE,
  VALK_PACK,
  VISION_CYCLE,
  VISION_PACK,
  VNM_CYCLE,
  VNM_PACK,
  WARM_CYCLE,
  WARM_PACK,
  WAVE1_ENCOUNTER_SETS,
  WAVE1_SCENARIOS,
  WAVE1_STARTER_DECKS,
  WAVE2_ENCOUNTER_SETS,
  WAVE2_SCENARIOS,
  WAVE2_STARTER_DECKS,
  WAVE3_ENCOUNTER_SETS,
  WAVE3_SCENARIOS,
  WAVE3_STARTER_DECKS,
  WAVE4_ENCOUNTER_SETS,
  WAVE4_SCENARIOS,
  WAVE4_STARTER_DECKS,
  WAVE5_ENCOUNTER_SETS,
  WAVE5_SCENARIOS,
  WAVE5_STARTER_DECKS,
  WAVE6_ENCOUNTER_SETS,
  WAVE6_STARTER_DECKS,
  WAVE7_ENCOUNTER_SETS,
  WAVE7_SCENARIOS,
  WAVE7_STARTER_DECKS,
  WAVE8_ENCOUNTER_SETS,
  WAVE8_SCENARIOS,
  WAVE8_STARTER_DECKS,
  AOA_CYCLE,
  AOA_PACK,
  ICEMAN_CYCLE,
  ICEMAN_PACK,
  JUBILEE_CYCLE,
  JUBILEE_PACK,
  NCRAWLER_CYCLE,
  NCRAWLER_PACK,
  MAGNETO_CYCLE,
  MAGNETO_PACK,
  MUT_GEN_SCENARIOS,
  MOJO_SCENARIOS,
  WSP_CYCLE,
  WSP_PACK,
  poolVersionOf,
  type AnyCard,
  type Cycle,
  type EncounterSet,
  type Pack,
  type Scenario,
  type StarterDeck,
} from "@mc/content";
import type { EngineDeps } from "@mc/engine";
import { POOL_CARDS } from "./pool-cards.js";
import type { ShelfPack } from "../view/roster-shelves.js";

// Defined in `pool-cards.ts` so the build can read it without the rules engine; re-exported so this stays the one import site.
export { POOL_CARDS };

/** Every card in `POOL_CARDS`, by id — the one lookup every setup screen needs (a scenario's villain/main scheme, a deck's identity, a seat's hero). Built once, from the pool alone, so no screen keeps its own copy. */
export const CARDS_BY_ID: ReadonlyMap<string, AnyCard> = new Map(POOL_CARDS.map((card) => [card.id as string, card]));

/** Every encounter set the app's pool knows (Core's plus every wave 1 and cycle 1 pack's), for a screen that names one (a scenario's own sets, a modular set picker, an encounter deck preview). `WAVE1_ENCOUNTER_SETS` and `WAVE2_ENCOUNTER_SETS` deliberately exclude Core's own sets (`@mc/content`'s own doc comment), so all three are combined here. */
export const POOL_ENCOUNTER_SETS: readonly EncounterSet[] = [
  ...CORE_ENCOUNTER_SETS,
  ...WAVE1_ENCOUNTER_SETS,
  ...WAVE2_ENCOUNTER_SETS,
  ...WAVE3_ENCOUNTER_SETS,
  ...WAVE4_ENCOUNTER_SETS,
  ...WAVE5_ENCOUNTER_SETS,
  ...WAVE6_ENCOUNTER_SETS,
  ...WAVE7_ENCOUNTER_SETS,
  ...WAVE8_ENCOUNTER_SETS,
];

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

/** Every ability script for `POOL_CARDS` (Core's own scripts included — every wave's registry starts from `CORE_ABILITIES`). */
export const POOL_DEPS: EngineDeps = PLAYABLE_DEPS;

/** Every scenario, Core first (Rhino, Klaw, Ultron), then wave 1 (Risky Business, Mutagen Formula, Breakout), then cycle 1 (The Rise of Red Skull's five, and Kang), then cycle 2 (The Galaxy's Most Wanted's five), then cycle 3 (The Mad Titan's Shadow's five, and The Hood). */
export const POOL_SCENARIOS: readonly Scenario[] = [
  ...CORE_SCENARIOS,
  ...WAVE1_SCENARIOS,
  ...WAVE2_SCENARIOS,
  ...WAVE3_SCENARIOS,
  ...WAVE4_SCENARIOS,
  ...WAVE5_SCENARIOS,
  // Mutant Genesis' five and MojoMania's three (MaGog, Spiral, Mojo): the other cycle 6 hero packs define no scenarios.
  ...MUT_GEN_SCENARIOS,
  ...MOJO_SCENARIOS,
  // NeXt Evolution's five (Morlock Siege, On the Run, Juggernaut, Mister Sinister, Stryfe): the four hero packs define none.
  ...WAVE7_SCENARIOS,
  // Age of Apocalypse's five (Unus, Four Horsemen, Apocalypse, Dark Beast, En Sabah Nur): the four hero packs define none.
  ...WAVE8_SCENARIOS,
];

/** Every starter deck, Core's six precons first, then the six wave 1 hero packs', then cycle 1's six, then cycle 2's six (Groot, Rocket Raccoon, Star-Lord, Gamora, Drax, Venom), then cycle 3's six (Spectrum, Adam Warlock, Nebula, War Machine, Vision, Valkyrie). */
export const POOL_STARTER_DECKS: readonly StarterDeck[] = [
  ...CORE_STARTER_DECKS,
  ...WAVE1_STARTER_DECKS,
  ...WAVE2_STARTER_DECKS,
  ...WAVE3_STARTER_DECKS,
  ...WAVE4_STARTER_DECKS,
  ...WAVE5_STARTER_DECKS,
  ...WAVE6_STARTER_DECKS,
  ...WAVE7_STARTER_DECKS,
  ...WAVE8_STARTER_DECKS,
];

/** This build's pool version — bumps whenever `POOL_CARDS` changes shape, which retires an older save/deck against it. */
export const POOL_VERSION: string = poolVersionOf(POOL_CARDS);

/**
 * Every physical product's own display name, by `Pack.code` (`Scenario.packCode`) — Core, all eight wave 1
 * packs and all six cycle 1 packs, not only the ones that define a scenario today, so a Title row naming a future scenario pack's own product
 * doesn't need this list touched again. `@mc/content` has no aggregated "every pack" export yet (PLAN.md Phase 7:
 * each pack module exports its own `*_PACK` constant), so this is that aggregate, scoped to what the app's pool
 * actually knows.
 */
export const POOL_PACKS: readonly Pack[] = [
  CORE_PACK,
  GOB_PACK,
  TWC_PACK,
  CAP_PACK,
  MSM_PACK,
  THOR_PACK,
  BKW_PACK,
  DRS_PACK,
  HLK_PACK,
  TRORS_PACK,
  TOAFK_PACK,
  ANT_PACK,
  WSP_PACK,
  QSV_PACK,
  SCW_PACK,
  GMW_PACK,
  STLD_PACK,
  GAM_PACK,
  DRAX_PACK,
  VNM_PACK,
  RON_PACK,
  MTS_PACK,
  NEBU_PACK,
  WARM_PACK,
  VISION_PACK,
  HOOD_PACK,
  VALK_PACK,
  SM_PACK,
  NOVA_PACK,
  IRONHEART_PACK,
  SPIDERHAM_PACK,
  SPDR_PACK,
  MUT_GEN_PACK,
  CYCLOPS_PACK,
  PHOENIX_PACK,
  WOLV_PACK,
  STORM_PACK,
  MOJO_PACK,
  GAMBIT_PACK,
  ROGUE_PACK,
  NEXT_EVOL_PACK,
  PSYLOCKE_PACK,
  ANGEL_PACK,
  X23_PACK,
  DEADPOOL_PACK,
  AOA_PACK,
  ICEMAN_PACK,
  JUBILEE_PACK,
  NCRAWLER_PACK,
  MAGNETO_PACK,
];

/** A pack's own display name ("The Wrecking Crew") by its code ("twc"), falling back to the code itself if the pool ever names one this list doesn't have. */
export function packNameOf(code: string): string {
  return POOL_PACKS.find((pack) => (pack.code as string) === code)?.name ?? code;
}

/**
 * Every `POOL_PACKS` entry paired with its own `Cycle` record — each pack module's own `*_CYCLE` export, not
 * derived or guessed, so a pack's cycle name/order here is exactly what `packages/content/src/data/<pack>/packs.ts`
 * prints. Order matches `POOL_PACKS`; every pack in the same cycle carries an identical `Cycle`.
 */
const POOL_PACK_CYCLES: readonly (readonly [Pack, Cycle])[] = [
  [CORE_PACK, CORE_CYCLE],
  [GOB_PACK, GOB_CYCLE],
  [TWC_PACK, TWC_CYCLE],
  [CAP_PACK, CAP_CYCLE],
  [MSM_PACK, MSM_CYCLE],
  [THOR_PACK, THOR_CYCLE],
  [BKW_PACK, BKW_CYCLE],
  [DRS_PACK, DRS_CYCLE],
  [HLK_PACK, HLK_CYCLE],
  [TRORS_PACK, TRORS_CYCLE],
  [TOAFK_PACK, TOAFK_CYCLE],
  [ANT_PACK, ANT_CYCLE],
  [WSP_PACK, WSP_CYCLE],
  [QSV_PACK, QSV_CYCLE],
  [SCW_PACK, SCW_CYCLE],
  [GMW_PACK, GMW_CYCLE],
  [STLD_PACK, STLD_CYCLE],
  [GAM_PACK, GAM_CYCLE],
  [DRAX_PACK, DRAX_CYCLE],
  [VNM_PACK, VNM_CYCLE],
  [RON_PACK, RON_CYCLE],
  [MTS_PACK, MTS_CYCLE],
  [NEBU_PACK, NEBU_CYCLE],
  [WARM_PACK, WARM_CYCLE],
  [VISION_PACK, VISION_CYCLE],
  [HOOD_PACK, HOOD_CYCLE],
  [VALK_PACK, VALK_CYCLE],
  [SM_PACK, SM_CYCLE],
  [NOVA_PACK, NOVA_CYCLE],
  [IRONHEART_PACK, IRONHEART_CYCLE],
  [SPIDERHAM_PACK, SPIDERHAM_CYCLE],
  [SPDR_PACK, SPDR_CYCLE],
  [MUT_GEN_PACK, MUT_GEN_CYCLE],
  [CYCLOPS_PACK, CYCLOPS_CYCLE],
  [PHOENIX_PACK, PHOENIX_CYCLE],
  [WOLV_PACK, WOLV_CYCLE],
  [STORM_PACK, STORM_CYCLE],
  [MOJO_PACK, MOJO_CYCLE],
  [GAMBIT_PACK, GAMBIT_CYCLE],
  [ROGUE_PACK, ROGUE_CYCLE],
  [NEXT_EVOL_PACK, NEXT_EVOL_CYCLE],
  [PSYLOCKE_PACK, PSYLOCKE_CYCLE],
  [ANGEL_PACK, ANGEL_CYCLE],
  [X23_PACK, X23_CYCLE],
  [DEADPOOL_PACK, DEADPOOL_CYCLE],
  [AOA_PACK, AOA_CYCLE],
  [ICEMAN_PACK, ICEMAN_CYCLE],
  [JUBILEE_PACK, JUBILEE_CYCLE],
  [NCRAWLER_PACK, NCRAWLER_CYCLE],
  [MAGNETO_PACK, MAGNETO_CYCLE],
];

/**
 * `POOL_PACKS`, reshaped into what `view/roster-shelves.ts`'s `cycleShelvesOf` needs to group the hero roster into
 * one shelf per release wave instead of one per pack (the "Take your seats" screen, docs/phase4-screen-gaps.md
 * §3 W2b superseded by the maintainer's 2026-09-23 call): each pack's own `cycleId`/`Cycle.order`/`releaseDate`,
 * nothing hand-curated per hero or pack name.
 */
export const POOL_HERO_SHELF_PACKS: readonly ShelfPack[] = POOL_PACK_CYCLES.map(([pack, cycle]) => ({
  code: pack.code as string,
  cycleId: cycle.id as string,
  cycleName: cycle.name,
  cycleOrder: cycle.order,
  ...(pack.releaseDate !== undefined ? { releaseDate: pack.releaseDate } : {}),
}));

/** The app's one scenario builder: Core, wave 1, cycle 1, cycle 2, cycle 3 and cycle 4 scenarios alike. */
export const buildScenario = playableScenario;

export type { PlayableScenarioOptions };
