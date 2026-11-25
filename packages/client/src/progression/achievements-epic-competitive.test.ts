import { describe, expect, it } from "vitest";
import { EPIC_COMPETITIVE_ACHIEVEMENTS } from "./achievements-epic-competitive.js";
import { NO_MULTIPLAYER_FACTS, type GameRow, type MultiplayerFacts } from "./room-seats.js";

const def = (id: string) => EPIC_COMPETITIVE_ACHIEVEMENTS.find((a) => a.id === id)!;
const measure = (id: string, facts: Partial<MultiplayerFacts>) =>
  def(id).measure({ ...NO_MULTIPLAYER_FACTS, ...facts });
const done = (id: string, facts: Partial<MultiplayerFacts>): boolean => {
  const p = measure(id, facts);
  return p !== null && p.current >= p.target;
};

const room = (mode: "standard" | "epic" | "competitive") =>
  ({ role: "host", mode, mySeats: ["p1"] }) as unknown as GameRow["roomPlay"];

const row = (over: Record<string, unknown> = {}): GameRow =>
  ({
    save: {},
    won: true,
    summary: null,
    roomPlay: undefined,
    config: { players: [{}] },
    mySeats: ["p1"],
    mySeatIndexes: [0],
    ...over,
  }) as unknown as GameRow;

const epic = (over: Record<string, unknown> = {}, groups = 2): GameRow =>
  row({ config: { players: [{}], epic: { groupId: "t1", groupsInGame: groups } }, ...over });

describe("Epic achievements", () => {
  it("Pod Person: an Epic game finished", () => {
    expect(done("epic-finished", { rows: [epic()] })).toBe(true);
    expect(done("epic-finished", { rows: [row()] })).toBe(false);
    expect(done("epic-finished", { competitiveRows: [epic()] })).toBe(false);
  });

  it("Shatter the Illusion: this group defeated the shared Loki", () => {
    const end = (lokiDefeatedByGroup: string | null) => ({
      summary: { endState: { groupId: "t1", lokiDefeatedByGroup } },
    });
    expect(done("epic-loki-final-blow", { rows: [epic(end("t1"))] })).toBe(true);
    expect(done("epic-loki-final-blow", { rows: [epic(end("t2"))] })).toBe(false);
    expect(done("epic-loki-final-blow", { rows: [epic(end(null))] })).toBe(false);
    expect(done("epic-loki-final-blow", { rows: [epic()] })).toBe(false);
  });

  const boosts = (seat: string, cardId: string, power: string) => ({
    summary: { boosts: { seats: { [seat]: { remoteDefeats: [{ cardId, power }] } }, leaderRedirects: {} } },
  });
  it("Mangog Hunter and Door Stop: my seat's remote defeat of the card with that power", () => {
    expect(done("epic-mangog-remote", { rows: [epic(boosts("p1", "55041", "attack"))] })).toBe(true);
    expect(done("epic-mangog-remote", { rows: [epic(boosts("p2", "55041", "attack"))] })).toBe(false);
    expect(done("epic-mangog-remote", { rows: [epic(boosts("p1", "55041", "thwart"))] })).toBe(false);
    expect(done("epic-door-remote", { rows: [epic(boosts("p1", "55046", "thwart"))] })).toBe(true);
    expect(done("epic-door-remote", { rows: [epic(boosts("p1", "55046", "attack"))] })).toBe(false);
    expect(done("epic-door-remote", { rows: [epic()] })).toBe(false);
  });

  it("Tables Turned: a win with three or more groups", () => {
    expect(done("epic-three-tables", { rows: [epic({}, 3)] })).toBe(true);
    expect(done("epic-three-tables", { rows: [epic({}, 2)] })).toBe(false);
    expect(done("epic-three-tables", { rows: [epic({ won: false }, 3)] })).toBe(false);
  });
});

type Team = { teamId: string; side: string; result: string; conditions: string[]; playerIds: string[] };
const team = (teamId: string, side: string, playerIds: string[], result: string, conditions: string[] = []): Team => ({
  teamId,
  side,
  result,
  conditions,
  playerIds,
});
interface Extra {
  tieBreak?: object;
  leaderRedirects?: Record<string, string[]>;
  leaders?: [string, string];
}
const comp = (mySeats: string[], teams: Team[], extra: Extra = {}): GameRow => {
  const [a, b] = extra.leaders ?? ["registration-iron-man", "resistance-captain-america"];
  return row({
    roomPlay: room("competitive"),
    mySeats,
    config: {
      players: [{}, {}],
      competitive: {
        teams: [
          { leaderScenarioId: a, playerCount: 1 },
          { leaderScenarioId: b, playerCount: 1 },
        ],
      },
    },
    summary: {
      competitive: { teams, ...(extra.tieBreak ? { tieBreak: extra.tieBreak } : {}) },
      boosts: { seats: {}, leaderRedirects: extra.leaderRedirects ?? {} },
    },
  });
};
/** A game where the seat I hold won, meeting these conditions. */
const win = (mySeat: "p1" | "p2", conditions: string[] = [], extra: Extra = {}): GameRow =>
  comp(
    [mySeat],
    [
      team("t1", "registration", ["p1"], mySeat === "p1" ? "win" : "loss", mySeat === "p1" ? conditions : []),
      team("t2", "resistance", ["p2"], mySeat === "p2" ? "win" : "loss", mySeat === "p2" ? conditions : []),
    ],
    extra,
  );
const lost = (extra: Extra = {}): GameRow =>
  comp(
    ["p1"],
    [team("t1", "registration", ["p1"], "loss"), team("t2", "resistance", ["p2"], "win", ["enemyLeaderDefeated"])],
    extra,
  );

describe("Competitive achievements", () => {
  it("Pick a Side: both sides, counted per side", () => {
    expect(measure("competitive-both-sides", { competitiveRows: [win("p1")] })?.current).toBe(1);
    expect(done("competitive-both-sides", { competitiveRows: [win("p1"), win("p2")] })).toBe(true);
    expect(done("competitive-both-sides", { competitiveRows: [win("p1"), win("p1")] })).toBe(false);
  });

  it("hot seat on both teams earns none, and ordinary rows never feed them", () => {
    const hot = comp(
      ["p1", "p2"],
      [team("t1", "registration", ["p1"], "win", ["enemyLeaderDefeated"]), team("t2", "resistance", ["p2"], "loss")],
      { tieBreak: { applied: true, decidedBy: "mainSchemeThreat" }, leaderRedirects: { t1: ["56137"] } },
    );
    for (const id of [
      "competitive-both-sides",
      "competitive-leader-down",
      "competitive-tie-break",
      "competitive-no-you-move",
    ]) {
      expect(done(id, { competitiveRows: [hot] }), id).toBe(false);
    }
    expect(measure("competitive-veteran", { competitiveRows: [hot] })?.current).toBe(0);
    expect(done("competitive-both-sides", { rows: [win("p1"), win("p2")] })).toBe(false);
  });

  it("earns nothing from a competitive save without a summary", () => {
    expect(done("competitive-both-sides", { competitiveRows: [row({ roomPlay: room("competitive") })] })).toBe(false);
  });

  it("Leader Down: my team met enemyLeaderDefeated", () => {
    expect(done("competitive-leader-down", { competitiveRows: [win("p1", ["enemyLeaderDefeated"])] })).toBe(true);
    expect(done("competitive-leader-down", { competitiveRows: [win("p1", ["opponentsLost"])] })).toBe(false);
    // The other team's condition is not mine.
    expect(done("competitive-leader-down", { competitiveRows: [lost()] })).toBe(false);
  });

  it("Tie-Breaker: my team won and the tie-break decided", () => {
    const decided = { tieBreak: { applied: true, decidedBy: "mainSchemeThreat" } };
    expect(done("competitive-tie-break", { competitiveRows: [win("p1", [], decided)] })).toBe(true);
    expect(done("competitive-tie-break", { competitiveRows: [win("p2", [], decided)] })).toBe(true);
    expect(done("competitive-tie-break", { competitiveRows: [win("p1")] })).toBe(false);
    const undecided = { tieBreak: { applied: true, decidedBy: null } };
    expect(done("competitive-tie-break", { competitiveRows: [win("p1", [], undecided)] })).toBe(false);
    expect(done("competitive-tie-break", { competitiveRows: [lost(decided)] })).toBe(false);
  });

  it("No, You Move!: Captain America's leader card took my team's redirect", () => {
    const redirected = (team: string, card: string) => ({ leaderRedirects: { [team]: [card] } });
    expect(done("competitive-no-you-move", { competitiveRows: [win("p1", [], redirected("t1", "56137"))] })).toBe(true);
    expect(done("competitive-no-you-move", { competitiveRows: [win("p1", [], redirected("t1", "56092"))] })).toBe(
      false,
    );
    expect(done("competitive-no-you-move", { competitiveRows: [win("p1", [], redirected("t2", "56137"))] })).toBe(
      false,
    );
    expect(done("competitive-no-you-move", { competitiveRows: [win("p1")] })).toBe(false);
  });

  it("Civil War Veteran: five wins with each of the four leaders", () => {
    const wins = (leaders: [string, string], seat: "p1" | "p2", n: number) =>
      Array.from({ length: n }, () => win(seat, [], { leaders }));
    const A: [string, string] = ["registration-iron-man", "resistance-captain-america"];
    const B: [string, string] = ["registration-captain-marvel", "resistance-spider-woman"];
    const ironMan = wins(A, "p1", 7);
    expect(measure("competitive-veteran", { competitiveRows: ironMan })?.current).toBe(5);
    const all = [...ironMan, ...wins(A, "p2", 5), ...wins(B, "p1", 5), ...wins(B, "p2", 5)];
    expect(done("competitive-veteran", { competitiveRows: all })).toBe(true);
    expect(done("competitive-veteran", { competitiveRows: all.slice(1) })).toBe(true);
    expect(done("competitive-veteran", { competitiveRows: all.slice(3) })).toBe(false);
    expect(measure("competitive-veteran", { competitiveRows: [] })?.target).toBe(20);
  });
});

describe("Watching and hosting", () => {
  it("Front Row Seat: one watched game", () => {
    expect(done("watch-to-end", { watched: 1 })).toBe(true);
    expect(done("watch-to-end", { watched: 0 })).toBe(false);
  });

  it("Game Night Host: ten hosted standard or Epic room games, never competitive", () => {
    const hosted = (mode: "standard" | "epic" | "competitive", n: number) =>
      Array.from({ length: n }, () => row({ roomPlay: room(mode) }));
    expect(done("host-10", { hostedRows: [...hosted("standard", 6), ...hosted("epic", 4)] })).toBe(true);
    expect(done("host-10", { hostedRows: [...hosted("standard", 6), ...hosted("competitive", 4)] })).toBe(false);
    expect(measure("host-10", { hostedRows: hosted("standard", 4) })?.current).toBe(4);
  });
});

describe("the list", () => {
  it("carries the plan's ids, points and families", () => {
    expect(EPIC_COMPETITIVE_ACHIEVEMENTS.map((a) => [a.id, a.points, a.family])).toEqual([
      ["epic-finished", 50, "epic"],
      ["epic-loki-final-blow", 150, "epic"],
      ["epic-mangog-remote", 100, "epic"],
      ["epic-door-remote", 100, "epic"],
      ["epic-three-tables", 150, "epic"],
      ["competitive-both-sides", 50, "competitive"],
      ["competitive-leader-down", 100, "competitive"],
      ["competitive-tie-break", 100, "competitive"],
      ["competitive-no-you-move", 50, "competitive"],
      ["competitive-veteran", 250, "competitive"],
      ["watch-to-end", 25, "hosting"],
      ["host-10", 100, "hosting"],
    ]);
  });
});
