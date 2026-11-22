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

  // MC56 p. 14: "either 1v1 ... or 2v2".
  const three = [...seats, { seat: "s3", player: { starterDeckId: "core-she-hulk-aggression" } }];
  it.each([
    ["1v2", { registration: ["s2"], resistance: ["s1", "s3"] }],
    ["2v1", { registration: ["s2", "s3"], resistance: ["s1"] }],
  ])("answers null for a %s table", (_, teams) => {
    expect(
      buildCompetitiveConfig({
        setup: { seed: 7, seats: three },
        sealed: { registration, resistance },
        teams,
        tieBreaks: true,
      }),
    ).toBeNull();
  });

  it.each([
    ["1v2", 1],
    ["2v1", 2],
  ])("refuses a %s config built by hand with a SetupError, not a crash", (_, first) => {
    const config = buildCompetitiveConfig({
      setup: { seed: 7, seats },
      sealed: { registration, resistance },
      teams: { registration: ["s2"], resistance: ["s1"] },
      tieBreaks: true,
    })!;
    const players = three.map((s) => s.player);
    const [one, two] = config.competitive!.teams;
    const uneven = {
      ...config,
      players,
      competitive: {
        ...config.competitive!,
        teams: [
          { ...one!, playerCount: first },
          { ...two!, playerCount: 3 - first },
        ],
      },
    } as typeof config;
    let thrown: unknown = null;
    try {
      freshBaseline(uneven);
    } catch (cause) {
      thrown = cause;
    }
    expect(thrown).toMatchObject({
      name: "SetupError",
      code: "invalid_setup",
      message: expect.stringMatching(/1v1 or 2v2/),
    });
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

import { CORE_CARDS, type AnyCard } from "@mc/content";
import { leaderClashRefusals, titleSharedWithLeader } from "./competitive-start.js";

describe("leaderClashRefusals", () => {
  const cards = new Map<string, AnyCard>(CORE_CARDS.map((c) => [c.id as string, c]));
  const input = (heroes: [string, string][]) => ({
    teams: { registration: ["s1"], resistance: ["s2"] },
    heroes: new Map(heroes),
    sealed: { registration, resistance },
    leaderName: (id: string) => (id === "registration-iron-man" ? "Iron Man" : "Captain America"),
    card: (id: string) => cards.get(id),
  });

  it("refuses the seat whose hero shares a title with its own team's leader, naming that seat alone", () => {
    // Iron Man 01029a on the registration team, whose leader is Iron Man; Spider-Man 01001a on resistance is fine.
    const refusals = leaderClashRefusals(
      input([
        ["s1", "01029a"],
        ["s2", "01001a"],
      ]),
    );
    expect(refusals.map((r) => r.seat)).toEqual(["s1"]);
    expect(refusals[0]!.reason).toMatch(/shares a title with your team's leader Iron Man/);
  });

  it("lets the other team field that hero, and matches an alter-ego title", () => {
    expect(
      leaderClashRefusals(
        input([
          ["s1", "01001a"],
          ["s2", "01029a"],
        ]),
      ),
    ).toEqual([]);
    expect(titleSharedWithLeader(cards.get("01029a"), "Tony Stark")).toBe("Iron Man");
  });
});
