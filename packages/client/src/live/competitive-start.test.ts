/**
 * Starting a Competitive room's game (issue #883): the two sealed scenarios and each seat's player become one two-team
 * `SessionConfig`, which the real setup turns into a game with two teams.
 */
import { describe, expect, it } from "vitest";
import {
  buildCompetitiveConfig,
  competitiveSeatOrder,
  localPlayersOf,
  parseSealedScenario,
  roomTeamsOf,
  type SealedScenario,
} from "./competitive-start.js";
import { freshBaseline } from "../engine/session-core.js";

const registration: SealedScenario = {
  leaderScenarioId: "registration-iron-man",
  modularSetIds: ["martial_law", "mighty_avengers", "paladin"],
  mainSchemeStageIds: [],
};
const resistance: SealedScenario = {
  leaderScenarioId: "resistance-captain-america",
  modularSetIds: ["new_avengers", "namor_modular", "secret_avengers"],
  mainSchemeStageIds: [],
};
const seats = [
  { seat: "s1", player: { starterDeckId: "hulkling-protection" } },
  { seat: "s2", player: { starterDeckId: "tigra-aggression" } },
];

describe("buildCompetitiveConfig", () => {
  it("puts registration's players first whatever the seat order", () => {
    // The lobby's s1 is on resistance, s2 on registration: s2 plays p1.
    const config = buildCompetitiveConfig({
      setup: { seed: 7, seats },
      sealed: { registration, resistance },
      teams: { registration: ["s2"], resistance: ["s1"] },
      tieBreaks: false,
    })!;
    expect(config.players).toEqual([seats[1]!.player, seats[0]!.player]);
    expect(config.scenarioId).toBe("registration-iron-man");
    expect(config.difficulty).toBe("standard");
    expect(config.competitive).toMatchObject({ tieBreaks: false });
    expect(config.competitive!.teams.map((t) => t.playerCount)).toEqual([1, 1]);
  });

  it("carries expert for the whole table", () => {
    const config = buildCompetitiveConfig({
      setup: { seed: 7, seats, expert: true },
      sealed: { registration, resistance },
      teams: { registration: ["s2"], resistance: ["s1"] },
      tieBreaks: true,
    })!;
    expect(config.difficulty).toBe("expert");
  });

  it("answers null for a scenario that does not read or a seat with no player", () => {
    const input = {
      setup: { seed: 7, seats },
      teams: { registration: ["s2"], resistance: ["s1"] },
      tieBreaks: true,
    } as const;
    expect(buildCompetitiveConfig({ ...input, sealed: { registration: 5, resistance } })).toBeNull();
    expect(
      buildCompetitiveConfig({
        ...input,
        sealed: { registration, resistance },
        teams: { registration: ["s9"], resistance: ["s1"] },
      }),
    ).toBeNull();
  });

  it("is a real two-team game once the engine sets it up", () => {
    const config = buildCompetitiveConfig({
      setup: { seed: 7, seats },
      sealed: { registration, resistance },
      teams: { registration: ["s2"], resistance: ["s1"] },
      tieBreaks: true,
    })!;
    const state = freshBaseline(config);
    expect(state.teams?.map((t) => [t.side, t.playerIds])).toEqual([
      ["registration", ["p1"]],
      ["resistance", ["p2"]],
    ]);
  });

  it("refuses a neutral modular set at setup", () => {
    const config = buildCompetitiveConfig({
      setup: { seed: 7, seats },
      sealed: {
        registration: { ...registration, modularSetIds: ["martial_law", "bomb_scare", "paladin"] },
        resistance,
      },
      teams: { registration: ["s2"], resistance: ["s1"] },
      tieBreaks: true,
    })!;
    expect(() => freshBaseline(config)).toThrow(/only registration and resistance sets/);
  });
});

describe("parseSealedScenario", () => {
  it("reads the shape and nothing else", () => {
    expect(parseSealedScenario(registration)).toEqual(registration);
    expect(parseSealedScenario({ leaderScenarioId: "x" })).toBeNull();
    expect(parseSealedScenario(null)).toBeNull();
    expect(parseSealedScenario({ ...registration, modularSetIds: [1] })).toBeNull();
  });
});

describe("seat order", () => {
  const room = {
    seats: [
      { id: "s1", team: "resistance", mine: true },
      { id: "s2", team: "registration", mine: false },
      { id: "s3", team: null, mine: false },
    ],
  } as never;
  it("is registration first, then resistance, without a seat that has no team", () => {
    expect(competitiveSeatOrder(room)).toEqual(["s2", "s1"]);
    expect(roomTeamsOf(room)).toEqual({ p1: "registration", p2: "resistance" });
    expect(localPlayersOf(room)).toEqual(["p2"]);
  });
});
