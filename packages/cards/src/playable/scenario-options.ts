/**
 * Which setup choices a playable scenario offers, as plain functions a setup screen asks before it draws a control
 * (docs/phase7-wave8.md section 4.1 Q1, Q9, Q10, Q12). `playableScenario` takes the answers through
 * `PlayableScenarioOptions` and refuses one the scenario does not offer, so a screen that follows these never builds a
 * game that throws.
 *
 * - **Standard and Expert set alternatives** (`difficultySetAlternativesFor`): The Hood insert, p. 2, "Alternative
 *   Sets": "When a scenario requires the Standard encounter set, the Standard II encounter set may be used instead",
 *   and the same for Expert II. Owner decision (Q10 = A, not printed in the insert or RRG): Standard III may replace the
 *   Standard set on any scenario that uses it. The rule reads the scenario record, never its pack: every scenario whose Standard set is the plain Standard set, from
 *   any box, is offered every other set of the Standard classification.
 * - **The Horsemen's versions** (`horsemanSidesOffer`): the Four Horsemen only, one A/B choice per villain (Q9 = B).
 * - **The easier Apocalypse start** (`offersEasierStart`): Apocalypse on standard only (Q12 = A).
 * - **Threat on Gene Pool** (`genePoolThreatOffer`): any game whose sets include Infinites (Q1 = A), 0 to 3 per player.
 * - **A Civil War scenario's choices** (docs/phase7-wave10.md §3.1, MC56 pp. 4-5): the two sides and their leaders
 *   (`sides`), the stage 1 and stage 2 options of the leader's side (`mainSchemeStages`), every modular set with
 *   whether this leader may use it (`modularSets`), and the game modes (`gameModes`). All four are null at a scenario
 *   that is not a Civil War leader. `modularSetCount` is the count of modular picks any scenario takes, as a range.
 * - **The villain** (`villainChoiceOffer`; docs/phase7-wave11-scenarios.md §S3.3, MC60 p. 5): the villains a Fear No
 *   Evil scenario may be played against and its default, answered as `PlayableScenarioOptions.villainSetId`. Null at
 *   every scenario whose villain is fixed (`Scenario.villainOptions` absent).
 */
import {
  PLAYABLE_CARDS,
  WAVE10_SCENARIOS,
  WAVE11_SCENARIOS,
  difficultySetChoiceErrors,
  type AnyCard,
  type CivilWarSide,
  type DifficultySetChoice,
  type EncounterSet,
  type PlayModes,
  type Scenario,
} from "@mc/content";
import { COMPETITIVE_MODE_UNAVAILABLE_MESSAGE, type GameMode } from "@mc/engine";
import { resolveModes } from "../core/setup.js";
import { mainSchemeStagesOffer, mainSchemeStagesProblem, type MainSchemeStagesOffer } from "../main-scheme-stages.js";
import {
  PLAYABLE_ENCOUNTER_SETS,
  PLAYABLE_SCENARIO_RECORDS,
  modularPickCountProblem,
  modularPickCountRange,
  modularPickProblem,
  scenarioOwnSetIds,
} from "../modular-pool.js";
import { WAVE10_GAME_ENCOUNTER_SETS, wave10MainSchemeCard } from "../wave10/setup.js";
import { WAVE11_GAME_ENCOUNTER_SETS } from "../wave11/setup.js";
import { INFINITES_GENE_POOL_THREAT_MAX, infinitesGenePoolThreatRecommendation } from "../wave8/aoa/infinites.js";
import { offersEasierStart, offersGenePoolThreat, standardSetReplaceable, type HorsemanSide } from "../wave8/setup.js";

export { offersEasierStart, offersGenePoolThreat, standardSetReplaceable };
export { infinitesGenePoolThreatRecommendation, INFINITES_GENE_POOL_THREAT_MAX };

/**
 * Whether a scenario's Expert set may be replaced by another set of the Expert classification (Expert II): exactly when
 * it requires the one Expert set. The Hood insert, p. 2: "When a scenario requires the Expert encounter set ... the
 * Expert II encounter set may be used instead."
 */
export const expertSetReplaceable = (scenario: Pick<Scenario, "expertEncounterSetIds">): boolean =>
  scenario.expertEncounterSetIds.length === 1 && scenario.expertEncounterSetIds[0] === "expert";

export interface DifficultySetAlternatives {
  /** Sets that may stand in for the Standard set (`DifficultySetChoice.standard`): Standard II, Standard III. */
  readonly standard: readonly string[];
  /** Sets that may stand in for the Expert set (`DifficultySetChoice.expert`): Expert II. Used in expert mode only. */
  readonly expert: readonly string[];
}

/**
 * The Standard and Expert sets a game of `scenario` may use in place of the printed ones, in the order `encounterSets`
 * lists them. Both lists are empty for a scenario that requires no Standard set or a set of its own.
 */
export function difficultySetAlternativesFor(
  scenario: Pick<Scenario, "standardEncounterSetIds" | "expertEncounterSetIds"> | undefined,
  encounterSets: readonly EncounterSet[] = PLAYABLE_ENCOUNTER_SETS,
): DifficultySetAlternatives {
  if (!scenario) return { standard: [], expert: [] };
  const others = (classification: "standard" | "expert", printed: readonly string[]): string[] =>
    encounterSets
      .filter((set) => set.classification === classification && !printed.includes(set.id))
      .map((set) => set.id as string);
  return {
    standard: standardSetReplaceable(scenario) ? others("standard", scenario.standardEncounterSetIds) : [],
    expert: expertSetReplaceable(scenario) ? others("expert", scenario.expertEncounterSetIds) : [],
  };
}

/**
 * Refuses a Standard or Expert set choice the scenario does not offer: a set that is unknown or of the wrong
 * classification, or a replacement at a scenario whose own set cannot be replaced. `playableScenario` calls it for every
 * wave's builder, so the rule is the same at Rhino as at Unus.
 */
export function checkPlayableDifficultySets(
  scenario: Pick<Scenario, "name" | "standardEncounterSetIds" | "expertEncounterSetIds">,
  choice: DifficultySetChoice | undefined,
  encounterSets: readonly EncounterSet[] = PLAYABLE_ENCOUNTER_SETS,
): void {
  if (!choice) return;
  const errors = difficultySetChoiceErrors(choice, encounterSets);
  if (errors.length > 0) throw new Error(`${scenario.name}: difficultySets: ${errors.join("; ")}`);
  if (choice.standard !== undefined && !standardSetReplaceable(scenario))
    throw new Error(`${scenario.name}: difficultySets: the scenario does not use the Standard set`);
  if (choice.expert !== undefined && !expertSetReplaceable(scenario))
    throw new Error(`${scenario.name}: difficultySets: the scenario does not use the Expert set`);
}

export interface HorsemanSidesOffer {
  /** The Horsemen in printed order (War, Famine, Pestilence, Death): the order `horsemanSides` is given in. */
  readonly villainNames: readonly string[];
  /** Where each selector starts for the modes being played: A on skirmish and standard, B on expert and heroic. */
  readonly defaultSides: readonly HorsemanSide[];
}

/**
 * The per-villain A/B choice of the Four Horsemen (MC45 p. 11; Q9 = B), or null for every other scenario. A scenario
 * offers it when each of its villains prints a side B card (`MultipleVillains.villains[].sideBCardId`).
 */
export function horsemanSidesOffer(
  scenario: Pick<Scenario, "multipleVillains"> | undefined,
  modes: PlayModes = {},
): HorsemanSidesOffer | null {
  const villains = scenario?.multipleVillains?.villains ?? [];
  if (villains.length === 0 || villains.some((entry) => entry.sideBCardId === undefined)) return null;
  const side: HorsemanSide = modes.expert || modes.heroic ? "B" : "A";
  return {
    villainNames: villains.map(
      (entry) => PLAYABLE_CARDS.find((card) => card.id === entry.villainCardId)?.name ?? entry.villainCardId,
    ),
    defaultSides: villains.map(() => side),
  };
}

/**
 * The encounter sets a game of `scenario` is known to use before it is built: its own, each villain's, and the modular
 * picks (the recommendation when none are stated and the scenario draws from no pool; a random pick from a pool is not
 * known until the game is built, so it is not listed).
 */
export function scenarioGameSetIds(scenario: Scenario, modularSetIds?: readonly string[]): readonly string[] {
  const picks = modularSetIds ?? (scenario.modularSetPool ? [] : scenario.recommendedModularSetIds);
  return [...new Set<string>([...scenarioOwnSetIds(scenario), ...picks])];
}

export interface GenePoolThreatOffer {
  /** The most threat per player the control takes; the least is 0, which is off. */
  readonly max: number;
  /** The rulebook's amount for the modes being played (MC45 p. 8): where the control starts once it is turned on. */
  readonly recommended: number;
}

/** The Infinites set's "Modular Difficulty" for a game that uses these sets, or null when Infinites is not among them. */
export function genePoolThreatOffer(
  encounterSetIds: readonly string[],
  modes: PlayModes = {},
): GenePoolThreatOffer | null {
  if (!offersGenePoolThreat(encounterSetIds)) return null;
  return { max: INFINITES_GENE_POOL_THREAT_MAX, recommended: infinitesGenePoolThreatRecommendation(modes) };
}

export interface ModularSetCountOffer {
  /** The fewest and the most modular sets a game of the scenario takes; equal at a scenario with one count. */
  readonly min: number;
  readonly max: number;
  /** Why the picks made so far are too few or too many, in the builder's own words; null when the count is fine. */
  readonly problem: string | null;
}

export interface CivilWarLeaderOffer {
  /** The leader's scenario: what `playableScenario` and `playableScenarioOffer` are asked for. */
  readonly scenarioId: string;
  readonly name: string;
  /** The leader's villain card, for its art. */
  readonly leaderCardId: string;
}

export interface CivilWarSideOffer {
  readonly side: CivilWarSide;
  readonly name: string;
  /** The side's leaders in printed order. */
  readonly leaders: readonly CivilWarLeaderOffer[];
}

/** One modular set a Civil War builder may show, and whether the leader may use it. */
export interface ModularSetLegality {
  readonly id: string;
  readonly name: string;
  /** The set's Civil War side; null for a neutral set (any other product's). */
  readonly side: CivilWarSide | null;
  /** Printed cards in the set, copies counted. */
  readonly cardCount: number;
  /** The card type the set holds most of (`"minion"`, `"treachery"`), for a tile's label; null for a set with no cards. */
  readonly dominantCardType: AnyCard["type"] | null;
  /** One of the leader's preconstructed four (MC56 pp. 7-8). */
  readonly recommended: boolean;
  readonly ok: boolean;
  /** Why the leader cannot use the set (the other side's reason, MC56 p. 4); null when `ok`. */
  readonly problem: string | null;
}

export interface GameModeOption {
  readonly mode: GameMode;
  readonly available: boolean;
  /** What to say beside a mode that cannot be chosen yet; null for one that can. */
  readonly note: string | null;
}

/** The stage options of a Civil War leader's side, with what is wrong with the stages picked so far (null: nothing). */
export interface MainSchemeStagesChoiceOffer extends MainSchemeStagesOffer {
  readonly problem: string | null;
}

/** One villain a scenario may be played against (`Scenario.villainOptions`). */
export interface VillainChoice {
  /** What `PlayableScenarioOptions.villainSetId` is given to pick it. */
  readonly villainSetId: string;
  /** The villain's encounter set name ("Typhoid Mary"): the villain card's own may name its other face. */
  readonly name: string;
  /** The villain card, for its art. */
  readonly villainCardId: string;
}

/** The villains of a scenario whose villain is a setup choice, in printed order, and the one absent picks. */
export interface VillainChoiceOffer {
  readonly defaultSetId: string;
  readonly options: readonly VillainChoice[];
}

export interface PlayableScenarioChoices {
  /** `"extreme"` (Breakout) is not expert as far as these options go, as in `resolveModes`. */
  readonly difficulty?: string;
  readonly modes?: PlayModes;
  /** The modular sets picked so far; absent is the scenario's recommendation. */
  readonly modularSetIds?: readonly string[];
  /** The main scheme stages picked so far (`CoreScenarioOptions.mainSchemeStageIds`); absent is the recommendation. */
  readonly mainSchemeStageIds?: readonly string[];
}

export interface PlayableScenarioOffer {
  readonly difficultySets: DifficultySetAlternatives;
  readonly horsemanSides: HorsemanSidesOffer | null;
  readonly easierStart: boolean;
  readonly genePoolThreat: GenePoolThreatOffer | null;
  /** How many modular sets the scenario takes, and what is wrong with the number picked so far. */
  readonly modularSetCount: ModularSetCountOffer;
  /** The Civil War box's two sides and their leaders; null at any other scenario. */
  readonly sides: readonly CivilWarSideOffer[] | null;
  /** The stage 1 and stage 2 options of a Civil War leader's side; null at any other scenario. */
  readonly mainSchemeStages: MainSchemeStagesChoiceOffer | null;
  /** Every modular set a Civil War builder may show, with its legality at this leader; null at any other scenario. */
  readonly modularSets: readonly ModularSetLegality[] | null;
  /** Cooperative and competitive, at a Civil War leader; null at any other scenario (cooperative only). */
  readonly gameModes: readonly GameModeOption[] | null;
  /** The villains to choose among (MC60 p. 5); null at a scenario whose villain is fixed. */
  readonly villains: VillainChoiceOffer | null;
}

const SIDE_NAMES: Readonly<Record<CivilWarSide, string>> = { registration: "Registration", resistance: "Resistance" };

const isCivilWarLeader = (scenario: Scenario): boolean =>
  scenario.side !== undefined && WAVE10_SCENARIOS.some((candidate) => candidate.id === scenario.id);

/** The two sides of the Civil War box and each side's leaders (MC56 p. 4, steps 1 and 2), registration first. */
export function civilWarSidesOffer(): readonly CivilWarSideOffer[] {
  return (["registration", "resistance"] as const).map((side) => ({
    side,
    name: SIDE_NAMES[side],
    leaders: WAVE10_SCENARIOS.filter((scenario) => scenario.side === side).map((scenario) => ({
      scenarioId: scenario.id as string,
      name: PLAYABLE_CARDS.find((card) => card.id === scenario.villainCardId)?.name ?? scenario.name,
      leaderCardId: scenario.villainCardId as string,
    })),
  }));
}

/**
 * Every set that is a modular set at a Civil War leader, the box's sixteen first and then each neutral set from
 * another product, with whether this leader may use it. The one rule that separates them is the side rule, so a set is
 * listed when nothing but its side stands against it (`modularPickProblem` with and without the scenario's side). A
 * set with no cards in the pool cannot be shuffled in and is not listed.
 */
export function civilWarModularSets(
  scenario: Scenario,
  encounterSets: readonly EncounterSet[] = WAVE10_GAME_ENCOUNTER_SETS,
): readonly ModularSetLegality[] {
  const { side: _side, ...sideless } = scenario;
  const candidates = encounterSets.filter((set) => modularPickProblem(sideless, set.id, encounterSets) === null);
  const sidedFirst = [
    ...candidates.filter((set) => set.side !== undefined),
    ...candidates.filter((set) => set.side === undefined),
  ];
  const listed = sidedFirst.map((set) => {
    const counts = new Map<AnyCard["type"], number>();
    for (const card of PLAYABLE_CARDS)
      if ("encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(set.id))
        counts.set(card.type, (counts.get(card.type) ?? 0) + card.quantityInSet);
    const dominant = [...counts].reduce<readonly [AnyCard["type"], number] | null>(
      (best, entry) => (best === null || entry[1] > best[1] ? entry : best),
      null,
    );
    const problem = modularPickProblem(scenario, set.id, encounterSets);
    return {
      id: set.id as string,
      name: set.name,
      side: set.side ?? null,
      cardCount: [...counts.values()].reduce((sum, count) => sum + count, 0),
      dominantCardType: dominant ? dominant[0] : null,
      recommended: (scenario.recommendedModularSetIds as readonly string[]).includes(set.id),
      ok: problem === null,
      problem,
    };
  });
  return listed.filter((set) => set.cardCount > 0);
}

/**
 * The villains `scenario` may be played against (docs/phase7-wave11-scenarios.md §S1.2, §S3.3; MC60 p. 5: "one of
 * the five interchangeable villains"), or null when its villain is fixed. Each is named by its encounter set, because
 * a villain card's first face may carry another name (Typhoid Mary's is Bloody Mary, 60110b).
 */
export function villainChoiceOffer(
  scenario: Scenario,
  encounterSets: readonly EncounterSet[] = WAVE11_GAME_ENCOUNTER_SETS,
): VillainChoiceOffer | null {
  const choice = scenario.villainOptions;
  if (!choice) return null;
  return {
    defaultSetId: choice.defaultSetId as string,
    options: choice.options.map((option) => ({
      villainSetId: option.villainSetId as string,
      name:
        encounterSets.find((set) => set.id === option.villainSetId)?.name ??
        PLAYABLE_CARDS.find((card) => card.id === option.villainCardId)?.name ??
        (option.villainSetId as string),
      villainCardId: option.villainCardId as string,
    })),
  };
}

/** Cooperative and competitive (MC56 pp. 4, 14); the engine does not play a competitive game yet and says so. */
export function civilWarGameModes(): readonly GameModeOption[] {
  return [
    { mode: "cooperative", available: true, note: null },
    { mode: "competitive", available: false, note: COMPETITIVE_MODE_UNAVAILABLE_MESSAGE },
  ];
}

/**
 * Every optional setup choice a game of `scenarioId` offers under the choices made so far. Ask again when the
 * difficulty or the modular picks change: the easier start is standard only, the Horsemen's defaults follow the mode,
 * and the Gene Pool control follows the Infinites set. Throws for a scenario the playable pool does not have.
 */
export function playableScenarioOffer(
  scenarioId: string,
  choices: PlayableScenarioChoices = {},
): PlayableScenarioOffer {
  // A Civil War leader is answered before the wave is joined to the playable pool, so the builder screen can be made
  // against the real offer; no list of playable scenarios names one until then.
  const scenario =
    PLAYABLE_SCENARIO_RECORDS.find((candidate) => candidate.id === scenarioId) ??
    WAVE10_SCENARIOS.find((candidate) => candidate.id === scenarioId) ??
    WAVE11_SCENARIOS.find((candidate) => candidate.id === scenarioId);
  if (!scenario) throw new Error(`no playable scenario ${scenarioId}`);
  const modes = resolveModes(choices.difficulty, choices.modes);
  const civilWar = isCivilWarLeader(scenario);
  const stages = civilWar ? mainSchemeStagesOffer(scenario, wave10MainSchemeCard(scenario)) : null;
  return {
    difficultySets: difficultySetAlternativesFor(scenario),
    horsemanSides: horsemanSidesOffer(scenario, modes),
    easierStart: offersEasierStart(scenarioId, modes.expert ? "expert" : "standard"),
    genePoolThreat: genePoolThreatOffer(scenarioGameSetIds(scenario, choices.modularSetIds), modes),
    modularSetCount: {
      ...modularPickCountRange(scenario),
      problem: choices.modularSetIds ? modularPickCountProblem(scenario, choices.modularSetIds.length) : null,
    },
    sides: civilWar ? civilWarSidesOffer() : null,
    mainSchemeStages: stages && {
      ...stages,
      problem: mainSchemeStagesProblem(scenario, wave10MainSchemeCard(scenario), choices.mainSchemeStageIds, {
        encounterSets: WAVE10_GAME_ENCOUNTER_SETS,
      }),
    },
    modularSets: civilWar ? civilWarModularSets(scenario) : null,
    gameModes: civilWar ? civilWarGameModes() : null,
    villains: villainChoiceOffer(scenario),
  };
}
