import { describe, expect, test } from "vitest";
import { campaignId, encounterSetId } from "./ids.js";
import {
  difficultyEncounterSetIds,
  difficultyOf,
  difficultySetChoiceErrors,
  matchesModes,
  modesOf,
  PRINTED_DIFFICULTY_SETS,
  STANDARD_MODES,
  type PlayModes,
} from "./modes.js";
import type { EncounterSet, ScenarioDifficulty } from "./sets.js";

const TRORS = campaignId("trors");

/**
 * `difficultyOf`/`modesOf` are the pair that lets the whole codebase keep reading a two-value
 * `ScenarioDifficulty` while the thing actually chosen at setup is a mode set (RRG 1.8 pp. 28–29). If they ever
 * stop being inverses on that two-value axis, every villain-stage range and Expert-set selection silently
 * changes, so they're pinned here rather than trusted.
 */
describe("difficultyOf / modesOf", () => {
  const DIFFICULTIES: readonly ScenarioDifficulty[] = ["standard", "expert"];

  test("modesOf then difficultyOf is the identity on both difficulties", () => {
    for (const difficulty of DIFFICULTIES) expect(difficultyOf(modesOf(difficulty))).toBe(difficulty);
  });

  test("standard mode is the empty mode set, and the empty mode set is standard", () => {
    expect(modesOf("standard")).toEqual(STANDARD_MODES);
    expect(difficultyOf(STANDARD_MODES)).toBe("standard");
    expect(difficultyOf({})).toBe("standard");
  });

  test("expert mode is exactly `{ expert: true }`", () => {
    expect(modesOf("expert")).toEqual({ expert: true });
    expect(difficultyOf({ expert: true })).toBe("expert");
  });

  /**
   * The point of the whole exercise: campaign mode is a *second* axis. RRG 1.8 p. 29 lists campaign mode and
   * expert campaign mode separately from expert mode, so neither may leak into the difficulty projection —
   * a standard campaign must still start the villain at stage I.
   */
  test("campaign mode does not make a scenario expert, and neither does expert campaign mode", () => {
    expect(difficultyOf({ campaign: { campaignId: TRORS } })).toBe("standard");
    expect(difficultyOf({ campaign: { campaignId: TRORS, expertCampaign: true } })).toBe("standard");
    expect(difficultyOf({ expert: true, campaign: { campaignId: TRORS, expertCampaign: true } })).toBe("expert");
  });

  test("heroic level and skirmish don't move the difficulty projection either", () => {
    expect(difficultyOf({ heroic: 4 })).toBe("standard");
    expect(difficultyOf({ skirmish: { villainVersion: "A" } })).toBe("standard");
    expect(difficultyOf({ expert: true, heroic: 1 })).toBe("expert");
  });
});

describe("matchesModes", () => {
  const STANDARD_CAMPAIGN: PlayModes = { campaign: { campaignId: TRORS } };
  const EXPERT_CAMPAIGN: PlayModes = { campaign: { campaignId: TRORS, expertCampaign: true } };

  test("no gate matches anything — an unprefixed instruction always runs", () => {
    expect(matchesModes({})).toBe(true);
    expect(matchesModes(EXPERT_CAMPAIGN)).toBe(true);
    expect(matchesModes({ expert: true }, undefined)).toBe(true);
  });

  test("`Expert Campaign Only` reads expertCampaign, not expert", () => {
    expect(matchesModes(EXPERT_CAMPAIGN, { expertCampaign: true })).toBe(true);
    expect(matchesModes(STANDARD_CAMPAIGN, { expertCampaign: true })).toBe(false);
    // Expert *mode* alone does not satisfy an expert *campaign* gate (RRG 1.8 p. 29 lists them separately).
    expect(matchesModes({ expert: true, ...STANDARD_CAMPAIGN }, { expertCampaign: true })).toBe(false);
  });

  test("an expert gate reads expert mode, not the expert campaign", () => {
    expect(matchesModes({ expert: true }, { expert: true })).toBe(true);
    expect(matchesModes(EXPERT_CAMPAIGN, { expert: true })).toBe(false);
  });

  test("a `false` condition is a real requirement, not an absent one", () => {
    expect(matchesModes({}, { expert: false })).toBe(true);
    expect(matchesModes({ expert: true }, { expert: false })).toBe(false);
    expect(matchesModes(STANDARD_CAMPAIGN, { expertCampaign: false })).toBe(true);
    expect(matchesModes(EXPERT_CAMPAIGN, { expertCampaign: false })).toBe(false);
  });

  test("heroicAtLeast is a threshold, and an absent heroic level is zero", () => {
    expect(matchesModes({ heroic: 2 }, { heroicAtLeast: 1 })).toBe(true);
    expect(matchesModes({ heroic: 2 }, { heroicAtLeast: 2 })).toBe(true);
    expect(matchesModes({ heroic: 1 }, { heroicAtLeast: 2 })).toBe(false);
    expect(matchesModes({}, { heroicAtLeast: 1 })).toBe(false);
    expect(matchesModes({}, { heroicAtLeast: 0 })).toBe(true);
  });

  test("every stated condition must hold at once", () => {
    const modes: PlayModes = { expert: true, heroic: 3, ...EXPERT_CAMPAIGN };
    expect(matchesModes(modes, { expert: true, expertCampaign: true, heroicAtLeast: 3 })).toBe(true);
    expect(matchesModes(modes, { expert: true, expertCampaign: true, heroicAtLeast: 4 })).toBe(false);
    expect(matchesModes(modes, { expert: false, expertCampaign: true })).toBe(false);
  });
});

/**
 * The Hood insert, p. 2, "Alternative Sets" (docs/phase7-wave4.md §4 Q5): Standard II / Expert II may be used *instead
 * of* the Standard / Expert set, each chosen independently, only where the scenario requires that set.
 */
describe("difficultyEncounterSetIds / difficultySetChoiceErrors", () => {
  const STANDARD = encounterSetId("standard");
  const EXPERT = encounterSetId("expert");
  const STANDARD_II = encounterSetId("standard_ii");
  const EXPERT_II = encounterSetId("expert_ii");
  const scenario = { standardEncounterSetIds: [STANDARD], expertEncounterSetIds: [EXPERT] };

  test("the printed default is the scenario's own sets", () => {
    expect(difficultyEncounterSetIds(scenario, "standard")).toEqual([STANDARD]);
    expect(difficultyEncounterSetIds(scenario, "expert", PRINTED_DIFFICULTY_SETS)).toEqual([STANDARD, EXPERT]);
  });

  test("each alternative replaces its printed set, independently", () => {
    expect(difficultyEncounterSetIds(scenario, "standard", { standard: STANDARD_II })).toEqual([STANDARD_II]);
    expect(difficultyEncounterSetIds(scenario, "expert", { standard: STANDARD_II })).toEqual([STANDARD_II, EXPERT]);
    expect(difficultyEncounterSetIds(scenario, "expert", { expert: EXPERT_II })).toEqual([STANDARD, EXPERT_II]);
    expect(difficultyEncounterSetIds(scenario, "expert", { standard: STANDARD_II, expert: EXPERT_II })).toEqual([
      STANDARD_II,
      EXPERT_II,
    ]);
  });

  test("Expert II is not added in standard mode, and nothing is added where no set is required", () => {
    expect(difficultyEncounterSetIds(scenario, "standard", { expert: EXPERT_II })).toEqual([STANDARD]);
    const none = { standardEncounterSetIds: [], expertEncounterSetIds: [] };
    expect(difficultyEncounterSetIds(none, "expert", { standard: STANDARD_II, expert: EXPERT_II })).toEqual([]);
  });

  test("a chosen set must be known and of the matching classification", () => {
    const sets = [
      { id: STANDARD_II, name: "Standard II", packCodes: [], classification: "standard" },
      { id: EXPERT_II, name: "Expert II", packCodes: [], classification: "expert" },
      { id: encounterSetId("beasty_boys"), name: "Beasty Boys", packCodes: [] },
    ] as unknown as readonly EncounterSet[];
    expect(difficultySetChoiceErrors({ standard: STANDARD_II, expert: EXPERT_II }, sets)).toEqual([]);
    expect(difficultySetChoiceErrors({ standard: EXPERT_II }, sets)).toEqual([
      "standard set expert_ii is not in the standard classification",
    ]);
    expect(difficultySetChoiceErrors({ expert: encounterSetId("beasty_boys") }, sets)).toEqual([
      "expert set beasty_boys is not in the expert classification",
    ]);
    expect(difficultySetChoiceErrors({ standard: encounterSetId("nope") }, sets)).toEqual([
      "standard set nope is not a known encounter set",
    ]);
  });
});
