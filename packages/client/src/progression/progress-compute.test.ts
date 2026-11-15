import { describe, expect, it } from "vitest";
import { POOL_SCENARIOS } from "../content/pool.js";
import {
  achievementPointsOf,
  achievementStatuses,
  lifetimePointsOf,
  type AchievementHistory,
  type AchievementSave,
} from "./achievements.js";
import { NO_DECK_FEATS } from "./deck-feats.js";
import { extrasProgressOf } from "./extras.js";
import {
  computeProgress,
  definitionsHistoryOf,
  historyOf,
  statusesOf,
  type ProgressInputs,
  type ProgressReads,
  type ProgressSaves,
} from "./progress-compute.js";
import { UNLOCK_HEROES, progressOf } from "./unlocks.js";

const heroId = (name: string): string => UNLOCK_HEROES.find((h) => h.name === name)!.identityCardId;

const game = (scenarioId: string, status: "won" | "lost", difficulty = "standard"): AchievementSave => ({
  status,
  round: 5,
  config: { scenarioId, difficulty, players: [{ identityCardId: heroId("Spider-Man (Peter Parker)"), deck: [] }] },
});

const inputs: ProgressInputs = {
  howToPlay: { done: 2, total: 6 },
  unlockedEverything: false,
  deckFeats: NO_DECK_FEATS,
  mods: {
    installed: { "fan-hero": "hero" },
    packs: [
      {
        id: "fan-hero",
        name: "Fan Hero",
        installed: true,
        achievements: [
          { id: "rising", name: "Rising", description: "Win.", when: { win: true, hero: "x.fan-hero.01a" } },
        ],
      },
    ],
  },
} as unknown as ProgressInputs;

const scenarios = POOL_SCENARIOS.slice(0, 3).map((scenario) => scenario.id);
const reads: ProgressReads = {
  saves: [
    game(scenarios[0]!, "won"),
    game(scenarios[1]!, "won", "expert"),
    game(scenarios[2]!, "lost"),
  ] as unknown as ProgressSaves,
  campaigns: [],
  decksBuilt: true,
};

describe("computeProgress (issue #722)", () => {
  it("works out what refreshUnlocks did on the main thread, from the same reads", () => {
    const history: AchievementHistory = historyOf(inputs, reads);
    const statuses = achievementStatuses(history);
    const result = computeProgress(inputs, reads);
    const earnedIds = statuses.filter((status) => status.earned).map((status) => status.def.id);
    expect(result.earnedIds).toEqual(earnedIds);
    expect(result.earnedIds.length).toBeGreaterThan(0);
    expect(result.extrasProgress).toEqual(extrasProgressOf(reads.saves, reads.campaigns, earnedIds));
    expect(result.progress).toEqual(progressOf(reads.saves, reads.campaigns));
    expect(result.achievementPoints).toBe(achievementPointsOf(history));
    expect(result.lifetimePoints).toBe(lifetimePointsOf(history));
  });

  it("a deck built in your decks counts as built, as before", () => {
    expect(historyOf(inputs, reads).decks?.built).toBe(true);
    expect(historyOf(inputs, { ...reads, decksBuilt: false }).decks?.built).toBe(false);
  });

  it("its result is plain data a worker can post (no functions, no definitions)", () => {
    const result = computeProgress(inputs, reads);
    expect(structuredClone(result)).toEqual(result);
    expect(JSON.stringify(result)).not.toContain('"def"');
  });
});

describe("statusesOf", () => {
  it("rebuilds the Trophy Room's statuses from the result without the saves", () => {
    const result = computeProgress(inputs, reads);
    const direct = achievementStatuses(historyOf(inputs, reads));
    const rebuilt = statusesOf(inputs, result.measured);
    expect(rebuilt.map((status) => [status.def.id, status.earned, status.progress])).toEqual(
      direct.map((status) => [status.def.id, status.earned, status.progress]),
    );
  });

  it("lists a pack's own achievements from the inputs alone", () => {
    const ids = achievementStatuses(definitionsHistoryOf(inputs)).map((status) => status.def.id);
    expect(ids.some((id) => id.includes("fan-hero"))).toBe(true);
  });

  it("an achievement the result didn't measure reads as not earned", () => {
    const rebuilt = statusesOf(inputs, []);
    expect(rebuilt.every((status) => !status.earned)).toBe(true);
  });
});
