/**
 * Modes of play as a composable *set*, rather than a single difficulty enum.
 *
 * RRG 1.8's "Modes of Play" entry (pp. 28-29) names five ways a scenario can be played: standard mode, expert
 * mode, heroic mode ("such as heroic level 1 or 4"), skirmish mode ("also sometimes called Rookie Mode"), and
 * campaign mode — and it lists "expert campaign mode" *under campaign mode*, separately from expert mode. So
 * these are independent axes chosen per scenario and combined, not points on one difficulty scale, and
 * `ScenarioDifficulty` ("standard" | "expert") is one two-value **projection** of the set rather than the set
 * itself (`difficultyOf` below).
 *
 * Only `expert` is consumed today: it selects the villain stage range (`Scenario.villainStages`), the Expert
 * encounter set (`Scenario.expertEncounterSetIds`) and any substituted villain (`Scenario.expertVillains`), all
 * through `difficultyOf`. `campaign`, `heroic` and `skirmish` are typed now and read by nothing — the point of
 * the set is that adding a consumer later does not move a single call site.
 *
 * Nothing here reaches `GameState`. What reaches the engine is the *resolved consequence* of the modes (a stage
 * range, a list of encounter sets), which is why this file lives in `@mc/content` and names no card, scenario or
 * campaign.
 */

import type { CampaignId, EncounterSetId } from "./ids.js";
import type { EncounterSet, Scenario, ScenarioDifficulty } from "./sets.js";

/**
 * Which campaign a scenario is being played as part of.
 *
 * `expertCampaign` is a modification of *campaign* mode and is orthogonal to `PlayModes.expert`: RRG 1.8 p. 29
 * lists it under campaign mode while expert mode has its own entry, and rulebooks print `Expert Campaign Only`
 * instructions separately from their "remove X (I), add X (III) for expert mode" setup lines. Keeping two flags
 * is what lets a campaign instruction gate on either one.
 */
export interface CampaignModeRef {
  readonly campaignId: CampaignId;
  /** Gates the printed `Expert Campaign Only` instructions. Independent of `PlayModes.expert`. */
  readonly expertCampaign?: true;
}

/**
 * The modes a single scenario is being played under. Every field is absent by default, and absent everything is
 * standard mode (`STANDARD_MODES`). Flags are `true`-only rather than boolean so that "off" has exactly one
 * representation and two mode sets can be compared with `toEqual`.
 */
export interface PlayModes {
  /** Expert mode: the Expert encounter set is added and the villain starts one stage later. */
  readonly expert?: true;
  /** Heroic level X: X extra encounter cards per player in the villain phase. Typed, not built. */
  readonly heroic?: number;
  /** Skirmish (a.k.a. rookie) mode: one chosen villain version is used and the rest are removed. Typed, not built. */
  readonly skirmish?: { readonly villainVersion: string };
  /** Campaign mode: which campaign this scenario belongs to, and whether it is the expert campaign. */
  readonly campaign?: CampaignModeRef;
}

/**
 * A mode gate on something a mode can switch on or off — a campaign instruction with an `Expert Campaign Only`
 * prefix, a log field only tracked in the expert campaign, a setup line only used in expert mode. Every stated
 * condition must hold (`matchesModes`); an absent condition does not care either way.
 */
export interface ModePredicate {
  readonly expert?: boolean;
  readonly expertCampaign?: boolean;
  readonly heroicAtLeast?: number;
}

/** Standard mode: no modification at all (RRG 1.8 p. 28). */
export const STANDARD_MODES: PlayModes = {};

/** Whether a mode set satisfies a gate. No gate means "always", which is what an unprefixed instruction is. */
export const matchesModes = (modes: PlayModes, gate?: ModePredicate): boolean => {
  if (!gate) return true;
  if (gate.expert !== undefined && gate.expert !== (modes.expert === true)) return false;
  if (gate.expertCampaign !== undefined && gate.expertCampaign !== (modes.campaign?.expertCampaign === true))
    return false;
  if (gate.heroicAtLeast !== undefined && (modes.heroic ?? 0) < gate.heroicAtLeast) return false;
  return true;
};

/**
 * The two-value projection the villain-stage table and the Standard/Expert set selection read. Every other mode
 * is invisible to it by design: campaign mode does not make a scenario expert, and expert *campaign* mode does
 * not either (RRG 1.8 p. 29 lists them separately).
 */
export const difficultyOf = (modes: PlayModes): ScenarioDifficulty => (modes.expert ? "expert" : "standard");

/** The mode set a bare `ScenarioDifficulty` means — the read path for callers (and saves) that predate `PlayModes`. */
export const modesOf = (difficulty: ScenarioDifficulty): PlayModes => (difficulty === "expert" ? { expert: true } : {});

/**
 * Which Standard and Expert encounter sets a game uses (docs/phase7-wave4.md §4 Q5). The Hood insert, p. 2,
 * "Alternative Sets": "When a scenario requires the Standard encounter set, the Standard II encounter set may be used
 * instead. When a scenario requires the Expert encounter set (most notably during Expert or Heroic modes of play), the
 * Expert II encounter set may be used instead." So an alternative set is a player's choice at setup, made for each of
 * the two independently, and it *replaces* the printed set rather than joining it. Absent (both fields) is the printed
 * default: the scenario's own `standardEncounterSetIds` / `expertEncounterSetIds`.
 *
 * Like `PlayModes`, nothing here reaches `GameState`: the engine sees the resolved card ids.
 */
export interface DifficultySetChoice {
  /** Used instead of the Standard set wherever a scenario requires it; a set of the `"standard"` classification. */
  readonly standard?: EncounterSetId;
  /** Used instead of the Expert set wherever a scenario requires it; a set of the `"expert"` classification. */
  readonly expert?: EncounterSetId;
}

/** The printed Standard and Expert sets: no alternative chosen. */
export const PRINTED_DIFFICULTY_SETS: DifficultySetChoice = {};

/**
 * The Standard (and in expert mode, Expert) encounter set ids a scenario is built with under `choice`. A scenario
 * that requires no Standard set (`standardEncounterSetIds: []`, The Wrecking Crew) gets none, chosen alternative or
 * not: the insert substitutes a set "when a scenario requires" it and never adds one.
 */
export function difficultyEncounterSetIds(
  scenario: Pick<Scenario, "standardEncounterSetIds" | "expertEncounterSetIds">,
  difficulty: ScenarioDifficulty,
  choice: DifficultySetChoice = PRINTED_DIFFICULTY_SETS,
): readonly EncounterSetId[] {
  const replace = (printed: readonly EncounterSetId[], alternative: EncounterSetId | undefined) =>
    printed.length > 0 && alternative !== undefined ? [alternative] : printed;
  return [
    ...replace(scenario.standardEncounterSetIds, choice.standard),
    ...(difficulty === "expert" ? replace(scenario.expertEncounterSetIds, choice.expert) : []),
  ];
}

/**
 * Why `choice` is not a legal difficulty-set choice among `sets` (empty when it is): each chosen set must be a known
 * set of the matching classification (RRG 1.8 "Standard Set", p. 40; "Expert Set", p. 19).
 */
export function difficultySetChoiceErrors(choice: DifficultySetChoice, sets: readonly EncounterSet[]): string[] {
  const errors: string[] = [];
  for (const slot of ["standard", "expert"] as const) {
    const id = choice[slot];
    if (id === undefined) continue;
    const set = sets.find((s) => s.id === id);
    if (!set) errors.push(`${slot} set ${id} is not a known encounter set`);
    else if (set.classification !== slot) errors.push(`${slot} set ${id} is not in the ${slot} classification`);
  }
  return errors;
}

/**
 * Optional setup rules a scenario's rulebook offers the players, chosen at setup. Like `PlayModes`, every field is
 * absent by default and a flag is `true`-only, so "off" has one representation and the choice is plain serializable
 * data. The scenario builder resolves a chosen option into `GameSetupConfig.scenarioSetupInstructions`; nothing here
 * reaches `GameState` directly.
 */
export interface ScenarioSetupOptions {
  /**
   * Tower Defense's "Modular Difficulty" (MC21 p. 11; docs/phase7-wave4.md §4 Q4): "If players wish to increase the
   * difficulty of the Tower Defense scenario, they may place damage on Avengers Tower during setup. … listed below are
   * some recommendations for each difficulty mode: Standard Mode: Place 1[per_hero] damage. Expert Mode: Place
   * 2[per_hero] damage. Heroic Mode: Place 3[per_hero] damage." When set, the recommendation for the mode being played
   * is placed. Absent (the default): no setup damage.
   */
  readonly towerDefenseSetupDamage?: true;
}

/** No optional setup rule chosen. */
export const NO_SCENARIO_SETUP_OPTIONS: ScenarioSetupOptions = {};
