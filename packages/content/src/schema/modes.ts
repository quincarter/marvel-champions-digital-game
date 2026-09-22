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

import type { CampaignId } from "./ids.js";
import type { ScenarioDifficulty } from "./sets.js";

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
