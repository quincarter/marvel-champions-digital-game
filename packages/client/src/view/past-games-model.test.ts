import { describe, expect, test } from "vitest";
import type { SaveMeta } from "../engine/game-storage.js";
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";
import {
  PAST_GAME_ACTIONS,
  ROW_SIDE_BY_SIDE_FROM,
  isPastGame,
  pastGameCounts,
  pastGameDetailParts,
  pastGameRowHeight,
  pastGameRowParts,
  pastGameRowsOf,
  pastGamesLayout,
  partialLogStop,
  playedMinutesOf,
  seatFatesOf,
  type PastGameNames,
} from "./past-games-model.js";

const NAMES: PastGameNames = {
  scenarioName: (id) => (id === "rhino" ? "Rhino" : undefined),
  identityName: (id) => ({ "spider-man": "Spider-Man", "she-hulk": "She-Hulk", "black-panther": "Black Panther" })[id],
  starterDeckName: (id) => (id === "she-hulk-aggression" ? "She-Hulk — Aggression" : undefined),
  campaignName: (id) => (id === "trors" ? "The Rise of Red Skull" : undefined),
  starterIdentity: (id) => (id === "she-hulk-aggression" ? "she-hulk" : undefined),
  scenarioCardId: (id) => (id === "rhino" ? "rhino-1" : undefined),
};

const save = (id: string, updatedAt: number, extra: Partial<SaveMeta> = {}): SaveMeta => ({
  id,
  schema: 4,
  config: {
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ identityCardId: "spider-man", deck: [] }],
    seed: 1,
  } as never,
  createdAt: 1,
  updatedAt,
  status: "won",
  round: 6,
  commandCount: 120,
  outcome: { result: "win", reason: "villainDefeated" } as never,
  campaignId: null,
  campaignNodeId: null,
  ...extra,
});

const seat = (identityCardId: string, defeated: boolean, extra: object = {}) => ({
  identityCardId,
  defeated,
  damage: 10,
  thwart: 4,
  ...extra,
});

describe("which saves are past games", () => {
  test("won, lost and left-unfinished games are; one still being played, or of a retired schema, is not", () => {
    expect(isPastGame(save("a", 1, { status: "won" }))).toBe(true);
    expect(isPastGame(save("a", 1, { status: "lost" }))).toBe(true);
    expect(isPastGame(save("a", 1, { status: "abandoned" }))).toBe(true);
    expect(isPastGame(save("a", 1, { status: "active" }))).toBe(false);
    expect(isPastGame(save("a", 1, { status: "incompatible" }))).toBe(false);
  });

  test("a game left before its first move, a newer schema's save, a newer build's game and a lesson are left out", () => {
    expect(isPastGame(save("a", 1, { status: "abandoned", commandCount: 0 }))).toBe(false);
    expect(isPastGame(save("a", 1, { schema: 99 }))).toBe(false);
    // A retired older schema, even finished with moves, is not a replay this build supports.
    expect(isPastGame(save("a", 1, { schema: 2 }))).toBe(false);
    expect(isPastGame(save("a", 1, { lastPlayedOn: { appVersion: "99.0.0" } as never }), "1.0.0")).toBe(false);
    expect(isPastGame(save("a", 1, { guided: { kind: "aspect", aspect: "justice" } }))).toBe(false);
  });
});

describe("pastGameRowsOf", () => {
  test("newest first, each with its result and why, rounds, villain and heroes", () => {
    const rows = pastGameRowsOf(
      [
        save("old", 100, {
          status: "lost",
          round: 3,
          outcome: { result: "loss", reason: "mainSchemeCompleted" } as never,
        }),
        save("new", 300, { playedMs: 42 * 60_000 }),
        save("left", 200, { status: "abandoned", outcome: null }),
        save("live", 400, { status: "active" }),
      ],
      NAMES,
    );
    expect(rows.map((row) => [row.id, row.result, row.reason])).toEqual([
      ["new", "won", "villainDefeated"],
      ["left", "unfinished", "unfinished"],
      ["old", "lost", "schemeCompleted"],
    ]);
    expect(rows[0]).toMatchObject({
      title: "Rhino · Spider-Man",
      scenarioId: "rhino",
      round: 6,
      endedAt: 300,
      playedMs: 42 * 60_000,
      villainCardId: "rhino-1",
      seats: [{ identityCardId: "spider-man", name: "Spider-Man", fell: null, damage: null, thwart: null }],
      campaign: null,
    });
    expect(rows[2]!.playedMs).toBeNull();
  });

  test("the summary says who fell and who stood, with their damage and thwart; a seat that sat out is not listed", () => {
    const [row] = pastGameRowsOf(
      [
        save("s", 1, {
          summary: {
            lossReason: null,
            seats: [
              seat("she-hulk", true),
              seat("black-panther", false, { damage: 22, thwart: 9 }),
              seat("spider-man", false, { satOut: true }),
            ],
          } as never,
        }),
      ],
      NAMES,
    );
    expect(row!.seats).toEqual([
      { identityCardId: "she-hulk", name: "She-Hulk", fell: true, damage: 10, thwart: 4 },
      { identityCardId: "black-panther", name: "Black Panther", fell: false, damage: 22, thwart: 9 },
    ]);
  });

  test("a game left unfinished says who fell, but nobody 'stood' to an end it never reached", () => {
    const [row] = pastGameRowsOf(
      [
        save("u", 1, {
          status: "abandoned",
          outcome: null,
          summary: { lossReason: "other", seats: [seat("she-hulk", true), seat("black-panther", false)] } as never,
        }),
      ],
      NAMES,
    );
    expect(row!.seats.map((s) => s.fell)).toEqual([true, null]);
  });

  test("a loss to every hero falling is a wipe even without a summary; a precon seat is its hero", () => {
    const [row] = pastGameRowsOf(
      [
        save("w", 1, {
          status: "lost",
          outcome: { result: "loss", reason: "allPlayersDefeated" } as never,
          config: { scenarioId: "unknown", players: [{ starterDeckId: "she-hulk-aggression" }], seed: 1 } as never,
        }),
      ],
      NAMES,
    );
    expect(row!.reason).toBe("heroesDefeated");
    expect(row!.seats).toEqual([
      { identityCardId: "she-hulk", name: "She-Hulk", fell: true, damage: null, thwart: null },
    ]);
    expect(row!.villainCardId).toBeNull();
  });

  test("why a game ended: a card's text, the encounter deck running out, or (with no outcome) the summary's reason", () => {
    const reasonOf = (extra: Partial<SaveMeta>): string => pastGameRowsOf([save("r", 1, extra)], NAMES)[0]!.reason;
    expect(reasonOf({ status: "lost", outcome: { result: "loss", reason: "cardAbility" } as never })).toBe("cardLoss");
    expect(reasonOf({ status: "lost", outcome: { result: "loss", reason: "encounterDeckExhausted" } as never })).toBe(
      "encounterDeckExhausted",
    );
    expect(reasonOf({ status: "lost", outcome: null, summary: { lossReason: "playersDefeated" } as never })).toBe(
      "heroesDefeated",
    );
    expect(reasonOf({ status: "won", outcome: null })).toBe("unknown");
  });

  test("a concession, stored as abandoned with a conceded outcome, reads as conceded, not unfinished", () => {
    const [row] = pastGameRowsOf(
      [
        save("c", 1, {
          status: "abandoned",
          outcome: { result: "conceded" } as never,
          summary: { lossReason: "conceded", seats: [seat("she-hulk", false)] } as never,
        }),
      ],
      NAMES,
    );
    expect([row!.result, row!.reason]).toEqual(["conceded", "conceded"]);
    expect(row!.seats[0]!.fell).toBeNull();
    expect(
      pastGameRowsOf([save("c", 1, { status: "abandoned", outcome: { result: "conceded" } as never })], NAMES, "lost"),
    ).toEqual([]);
  });

  test("a campaign game names its box", () => {
    expect(pastGameRowsOf([save("c", 1, { campaignId: "trors" })], NAMES)[0]!.campaign).toBe("The Rise of Red Skull");
  });

  test("the Wins and Losses filters keep only their games, and the counts match", () => {
    const saves = [save("w", 1), save("l", 2, { status: "lost" }), save("u", 3, { status: "abandoned" })];
    expect(pastGameRowsOf(saves, NAMES, "won").map((row) => row.id)).toEqual(["w"]);
    expect(pastGameRowsOf(saves, NAMES, "lost").map((row) => row.id)).toEqual(["l"]);
    expect(pastGameCounts([...saves, save("x", 4, { status: "active" })])).toEqual({ all: 3, won: 1, lost: 1 });
  });
});

describe("seatFatesOf", () => {
  const fate = (name: string, fell: boolean | null) => ({
    identityCardId: name,
    name,
    fell,
    damage: null,
    thwart: null,
  });

  test("the fallen and those who stood; a wipe when every hero fell; nothing for heroes the save can't speak for", () => {
    expect(seatFatesOf([fate("A", true), fate("B", false)])).toEqual({ fell: ["A"], stood: ["B"], wiped: false });
    expect(seatFatesOf([fate("A", true), fate("B", true)]).wiped).toBe(true);
    expect(seatFatesOf([fate("A", null)])).toEqual({ fell: [], stood: [], wiped: false });
  });
});

describe("partialLogStop", () => {
  test("a replay that stops short (a later command fails on this build) says where; a whole one says nothing", () => {
    expect(partialLogStop({ length: 12, total: 40, failure: { commandIndex: 12, message: "rejected" } })).toBe(12);
    expect(partialLogStop({ length: 12, total: 40, failure: null })).toBe(12);
    expect(partialLogStop({ length: 40, total: 40, failure: null })).toBeNull();
    expect(partialLogStop(null)).toBeNull();
  });
});

describe("playedMinutesOf", () => {
  test("whole minutes, at least one; nothing when the time was not counted", () => {
    expect(playedMinutesOf(null)).toBeNull();
    expect(playedMinutesOf(10_000)).toBe(1);
    expect(playedMinutesOf(42.4 * 60_000)).toBe(42);
  });
});

const within =
  (outer: Rect) =>
  (r: Rect): boolean =>
    r.x >= outer.x - 0.001 &&
    r.y >= outer.y - 0.001 &&
    r.x + r.width <= outer.x + outer.width + 0.001 &&
    r.y + r.height <= outer.y + outer.height + 0.001;

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe("pastGameRowParts", () => {
  // An iPhone SE's list (375 less the gutters and the scrollbar), a Pixel's, and the side panel's list on desktop.
  for (const width of [323, 360, 700]) {
    test(`a ${width}px row holds the villain and four heroes and its text without overlap`, () => {
      const row: Rect = { x: 20, y: 100, width, height: pastGameRowHeight(width) };
      const parts = pastGameRowParts(row, 4);
      expect(parts.pictures).toHaveLength(5);
      const inRow = within(row);
      for (const [i, pic] of parts.pictures.entries()) {
        expect(inRow(pic), `picture ${i}`).toBe(true);
        expect(overlaps(pic, parts.text)).toBe(false);
        if (i > 0) expect(overlaps(pic, parts.pictures[i - 1]!)).toBe(false);
      }
      expect(inRow(parts.text)).toBe(true);
      expect(parts.text.width).toBeGreaterThan(200);
    });
  }

  test("pictures sit beside the text on a wide row and above it on a phone's", () => {
    const wide = pastGameRowParts({ x: 0, y: 0, width: ROW_SIDE_BY_SIDE_FROM, height: 200 }, 1);
    expect(wide.text.x).toBeGreaterThan(wide.pictures.at(-1)!.x);
    const narrow = pastGameRowParts({ x: 0, y: 0, width: 330, height: 200 }, 1);
    expect(narrow.text.y).toBeGreaterThan(narrow.pictures[0]!.y + narrow.pictures[0]!.height);
  });
});

describe("pastGamesLayout and the details", () => {
  const sizes = [
    { name: "iPhone SE", width: 375, height: 667 },
    { name: "Pixel 10", width: 412, height: 923 },
    { name: "iPad portrait", width: 820, height: 1180 },
    { name: "iPad landscape", width: 1180, height: 820 },
    { name: "desktop", width: 1440, height: 980 },
  ];

  for (const size of sizes) {
    test(`${size.name}: the details fit the screen and their actions are touch-sized and apart`, () => {
      const area: Rect = { x: 16, y: 130, width: Math.min(size.width - 32, 1220), height: size.height - 146 };
      const layout = pastGamesLayout(area, size);
      expect(layout.side).toBe(size.width >= 700);
      const screen: Rect = { x: 0, y: 0, width: size.width, height: size.height };
      expect(within(screen)(layout.details)).toBe(true);
      if (layout.side) {
        expect(within(area)(layout.list)).toBe(true);
        expect(within(area)(layout.details)).toBe(true);
        expect(overlaps(layout.list, layout.details)).toBe(false);
      }
      const parts = pastGameDetailParts(layout.details, 4, !layout.side);
      const inPanel = within(layout.details);
      expect(parts.close !== null).toBe(!layout.side);
      for (const pic of parts.pictures) expect(inPanel(pic)).toBe(true);
      const actions = PAST_GAME_ACTIONS.map((action) => parts.actions[action]);
      for (const [i, rect] of actions.entries()) {
        expect(inPanel(rect)).toBe(true);
        expect(rect.height).toBeGreaterThanOrEqual(hit.target);
        for (const other of actions.slice(i + 1)) expect(overlaps(rect, other)).toBe(false);
      }
      expect(parts.text.height).toBeGreaterThan(120);
    });
  }
});
