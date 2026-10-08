/**
 * Which setup choices a playable scenario offers, as plain functions a setup screen asks before it draws a control
 * (docs/phase7-wave8.md section 4.1 Q1, Q9, Q10, Q12). `playableScenario` takes the answers through
 * `PlayableScenarioOptions` and refuses one the scenario does not offer, so a screen that follows these never builds a
 * game that throws.
 *
 * - **Standard and Expert set alternatives** (`difficultySetAlternativesFor`): The Hood insert, p. 2, "Alternative
 *   Sets": "When a scenario requires the Standard encounter set, the Standard II encounter set may be used instead",
 *   and the same for Expert II; Q10 = A: "Standard III may replace the Standard set on any scenario that uses it". The
 *   rule reads the scenario record, never its pack: every scenario whose Standard set is the plain Standard set, from
 *   any box, is offered every other set of the Standard classification.
 * - **The Horsemen's versions** (`horsemanSidesOffer`): the Four Horsemen only, one A/B choice per villain (Q9 = B).
 * - **The easier Apocalypse start** (`offersEasierStart`): Apocalypse on standard only (Q12 = A).
 * - **Threat on Gene Pool** (`genePoolThreatOffer`): any game whose sets include Infinites (Q1 = A), 0 to 3 per player.
 */
import {
  PLAYABLE_CARDS,
  difficultySetChoiceErrors,
  type DifficultySetChoice,
  type EncounterSet,
  type PlayModes,
  type Scenario,
} from "@mc/content";
import { resolveModes } from "../core/setup.js";
import { PLAYABLE_ENCOUNTER_SETS, PLAYABLE_SCENARIO_RECORDS, scenarioOwnSetIds } from "../modular-pool.js";
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

export interface PlayableScenarioChoices {
  /** `"extreme"` (Breakout) is not expert as far as these options go, as in `resolveModes`. */
  readonly difficulty?: string;
  readonly modes?: PlayModes;
  /** The modular sets picked so far; absent is the scenario's recommendation. */
  readonly modularSetIds?: readonly string[];
}

export interface PlayableScenarioOffer {
  readonly difficultySets: DifficultySetAlternatives;
  readonly horsemanSides: HorsemanSidesOffer | null;
  readonly easierStart: boolean;
  readonly genePoolThreat: GenePoolThreatOffer | null;
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
  const scenario = PLAYABLE_SCENARIO_RECORDS.find((candidate) => candidate.id === scenarioId);
  if (!scenario) throw new Error(`no playable scenario ${scenarioId}`);
  const modes = resolveModes(choices.difficulty, choices.modes);
  return {
    difficultySets: difficultySetAlternativesFor(scenario),
    horsemanSides: horsemanSidesOffer(scenario, modes),
    easierStart: offersEasierStart(scenarioId, modes.expert ? "expert" : "standard"),
    genePoolThreat: genePoolThreatOffer(scenarioGameSetIds(scenario, choices.modularSetIds), modes),
  };
}
