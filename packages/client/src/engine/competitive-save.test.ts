/**
 * A Civil War Competitive game counts as played only (the owner, 2026-11-20; issue #883): no unlocks, achievements,
 * champion points, scenario wins or losses, hero win rates, deck insights, previous-game fact or global stats, while
 * the summary keeps its competitive result apart for PvP tracking (#909). Every reader goes through
 * `isCompetitiveSave`.
 */
import { applyCommand, playerId, type GameState } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { finishedIdsOf, turnOnGlobalStats } from "../global-stats/global-consent.js";
import { globalResultOf } from "../global-stats/global-result.js";
import { resetGlobalUploadBackoff, runGlobalUpload } from "../global-stats/global-upload.js";
import { NAMES, jsonResponse, memoryStorage, meta } from "../global-stats/fixtures.js";
import { factsOf } from "../progression/achievements.js";
import { extrasProgressOf } from "../progression/extras.js";
import { modFactsOf } from "../progression/mod-achievements.js";
import { progressOf } from "../progression/unlocks.js";
import { deckInsightsOf } from "../view/deck-insights.js";
import { playerStatsOf } from "../view/player-stats-model.js";
import { resultsHistoryOf } from "../view/results-history.js";
import { isCompetitiveSave, type SaveMeta } from "./game-storage.js";
import { emptyRecord } from "./game-record.js";
import { summarizeGame } from "./game-summary.js";
import { lastFinishedResult } from "./previous-game-facts.js";

const TEAMS_OUTCOME = {
  result: "teams",
  reason: "competitiveEnded",
  decision: "win",
  teams: [
    { teamId: "t1", side: "registration", result: "win", conditions: ["enemyLeaderDefeated"] },
    { teamId: "t2", side: "resistance", result: "loss", conditions: [] },
  ],
} as unknown as SaveMeta["outcome"];

/** A competitive save this device's team won (`status` is the seat's team result, `seatResultOf`). */
const competitiveWin = (overrides: Partial<SaveMeta> = {}): SaveMeta => {
  const base = meta({ status: "won", outcome: TEAMS_OUTCOME, updatedAt: 9000, ...overrides });
  return { ...base, config: { ...base.config, roomTeams: { p1: "registration", p2: "resistance" } } };
};
const competitiveLoss = (): SaveMeta => competitiveWin({ status: "lost" });

describe("isCompetitiveSave", () => {
  test("a room's teams, the competitive scenarios or a per-team outcome mark one; a cooperative game is not", () => {
    expect(isCompetitiveSave(competitiveWin())).toBe(true);
    const plain = meta();
    expect(isCompetitiveSave(plain)).toBe(false);
    expect(isCompetitiveSave({ ...plain, config: { ...plain.config, competitive: {} as never } })).toBe(true);
    expect(isCompetitiveSave({ ...plain, outcome: TEAMS_OUTCOME })).toBe(true);
  });
});

describe("global stats never take a competitive game", () => {
  test("no global result, and not among the finished games the uploader could send", () => {
    expect(globalResultOf(competitiveWin(), NAMES, "0123456789abcdef0123456789abcdef")).toBeNull();
    expect(finishedIdsOf([competitiveWin({ id: "pvp" }), meta({ id: "coop" })])).toEqual(["coop"]);
  });

  test("the uploader posts nothing for it", async () => {
    resetGlobalUploadBackoff();
    const storage = memoryStorage();
    turnOnGlobalStats([], storage, 5000);
    let posts = 0;
    const fetchFn = async () => {
      posts += 1;
      return jsonResponse(200);
    };
    const deps = { baseUrl: "https://w.test", fetch: fetchFn as never, storage, names: NAMES, now: () => 10_000 };
    expect(await runGlobalUpload({ listSaves: async () => [competitiveWin({ id: "pvp" })] }, deps)).toBe(0);
    expect(posts).toBe(0);
  });
});

describe("progression counts a competitive game as played only", () => {
  const saves = [competitiveWin(), competitiveLoss()];

  test("achievements and champion points: no win, no loss", () => {
    const facts = factsOf({ saves, campaigns: [] });
    expect(facts.wins).toBe(0);
    expect(facts.losses).toBe(0);
    expect(facts.wonScenarios.size).toBe(0);
  });

  test("unlocks: no scenario won", () => {
    expect(progressOf(saves, []).wonScenarioIds).toEqual([]);
  });

  test("Extras: the scenario and heroes are played, never won or lost", () => {
    const progress = extrasProgressOf(saves, []);
    expect(progress.playedScenarioIds).toEqual(["rhino"]);
    expect(progress.wonScenarioIds).toEqual([]);
    expect(progress.lostScenarioIds).toEqual([]);
    expect(Object.keys(progress.heroWins)).toEqual([]);
    expect(Object.keys(progress.scenarioWins)).toEqual([]);
  });

  test("mod achievements: no win counted", () => {
    expect(modFactsOf({ saves, campaigns: [] }).communityWins).toBe(0);
  });

  test("the previous-game fact (Git Gud) skips it", () => {
    expect(lastFinishedResult([competitiveWin()])).toBeNull();
    const coop = meta({ status: "lost", updatedAt: 1 });
    expect(lastFinishedResult([coop, competitiveWin()])).toBe("lost");
  });
});

describe("stats count a competitive game as played only", () => {
  test("results history: a game played, neither a win nor a loss", () => {
    const [scenario] = resultsHistoryOf([competitiveWin()]).scenarios;
    expect(scenario?.combined).toMatchObject({ wins: 0, losses: 0, gamesPlayed: 1, bestClearRounds: null });
  });

  test("Your stats and deck insights: no win rate from it", () => {
    expect(playerStatsOf([competitiveWin()], NAMES).header.fraction).toBe(0);
    expect(playerStatsOf([competitiveWin()], NAMES).header.record).toBe(playerStatsOf([], NAMES).header.record);
    expect(deckInsightsOf([competitiveWin()], NAMES).heroes).toEqual({});
  });
});

const TEAM_TESTING = import.meta.glob("../../../engine/src/testing/team.ts");
interface TeamTesting {
  readonly competitiveGame: (options?: { readonly sizes?: readonly [number, number] }) => GameState;
}

describe("the summary keeps the competitive result apart (#909)", () => {
  let state: GameState;
  beforeAll(async () => {
    const { competitiveGame } = (await Object.values(TEAM_TESTING)[0]!()) as TeamTesting;
    // A 2v2 game: p3 (resistance) concedes for the resistance team, which ends it at once (N12 A).
    const result = applyCommand(competitiveGame({ sizes: [2, 2] }), { type: "concede", playerId: playerId("p3") });
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  });

  test("each seat's team result, the teams, the decision and the reason survive in the summary", () => {
    const summary = summarizeGame(state, emptyRecord())!;
    expect(summary.lossReason).toBe("competitive");
    expect(summary.winners).toEqual([]);
    expect(summary.finalBlowBy).toBeNull();
    expect(summary.competitive).toEqual({
      reason: "teamConceded",
      decision: "win",
      teams: [
        { teamId: "t1", side: "registration", result: "win", conditions: [], playerIds: ["p1", "p2"] },
        { teamId: "t2", side: "resistance", result: "loss", conditions: [], playerIds: ["p3", "p4"] },
      ],
      seats: ["win", "win", "loss", "loss"],
      concededBy: "p3",
    });
    // Plain data: it stores and structured-clones as is.
    expect(structuredClone(summary.competitive)).toEqual(summary.competitive);
  });
});
