import { describe, expect, test } from "vitest";
import type { SaveMeta } from "../engine/game-storage.js";
import type { Rect } from "./layout.js";
import {
  PAST_GAME_ACTIONS,
  aspectBadgesOf,
  aspectChipsOf,
  aspectsNotInName,
  pastGameMatches,
  isPastGame,
  pastGameCounts,
  pastGameRowsOf,
  pastGamesSidePanel,
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

/** What a seat the save says nothing about its deck for reads as (#756). */
const none = { aspects: [], aspectIds: [], deckName: null, topCards: [] };

describe("every seat's deck in a past game (#756)", () => {
  test("each seat has its aspects, its deck's name and its most played cards, most first", () => {
    const names: PastGameNames = {
      ...NAMES,
      cardName: (id) => ({ a: "Avenger", b: "Bash", c: "Cover", d: "Dive" })[id],
    };
    const [row] = pastGameRowsOf(
      [
        save("t", 1, {
          config: {
            scenarioId: "rhino",
            difficulty: "standard",
            players: [
              { starterDeckId: "she-hulk-aggression" },
              { identityCardId: "black-panther", deck: [], deckId: "mine", deckName: "Wakanda Wall" },
            ],
            seed: 1,
          } as never,
          summary: {
            lossReason: null,
            seats: [
              seat("she-hulk", false, {
                aspects: ["aggression"],
                starterDeckId: "she-hulk-aggression",
                plays: { b: 2 },
              }),
              seat("black-panther", false, {
                aspects: ["protection", "pool"],
                deckId: "mine",
                deckName: "Wakanda Wall",
                plays: { a: 1, b: 3, c: 3, d: 1 },
              }),
            ],
          } as never,
        }),
      ],
      names,
    );
    expect(row!.seats.map((s) => [s.deckName, s.aspects])).toEqual([
      ["She-Hulk — Aggression", ["Aggression"]],
      ["Wakanda Wall", ["Protection", "'Pool"]],
    ]);
    expect(row!.seats[0]!.topCards).toEqual([{ cardId: "b", name: "Bash", count: 2 }]);
    // Ties by name; at most three.
    expect(row!.seats[1]!.topCards.map((card) => [card.name, card.count])).toEqual([
      ["Bash", 3],
      ["Cover", 3],
      ["Avenger", 1],
    ]);
  });
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
      { ...none, identityCardId: "she-hulk", name: "She-Hulk", fell: true, damage: 10, thwart: 4 },
      { ...none, identityCardId: "black-panther", name: "Black Panther", fell: false, damage: 22, thwart: 9 },
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
      {
        ...none,
        identityCardId: "she-hulk",
        name: "She-Hulk",
        fell: true,
        damage: null,
        thwart: null,
        deckName: "She-Hulk — Aggression",
      },
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
    aspects: [],
    aspectIds: [],
    deckName: null,
    topCards: [],
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

describe("pastGamesSidePanel", () => {
  test("the details sit beside the list from 700px wide (desktop and a tablet either way up), and open as a popup under it", () => {
    for (const width of [820, 1024, 1180, 1440, 700]) expect(pastGamesSidePanel(width), String(width)).toBe(true);
    for (const width of [375, 412, 699]) expect(pastGamesSidePanel(width), String(width)).toBe(false);
  });
});

describe("aspectsNotInName", () => {
  test("an aspect the deck's name already says is left out, whatever its case or the 'Pool apostrophe", () => {
    expect(aspectsNotInName("Spider-Man (justice)", ["Justice", "Aggression"])).toEqual(["Aggression"]);
    expect(aspectsNotInName("Pool party", ["'Pool"])).toEqual([]);
    expect(aspectsNotInName(null, ["Justice"])).toEqual(["Justice"]);
  });
});

describe("searching the past games (#911)", () => {
  const names: PastGameNames = {
    ...NAMES,
    scenarioName: (id) => ({ rhino: "Rhino", klaw: "Klaw" })[id],
    identityName: (id) =>
      ({ "spider-man": "Spider-Man", "she-hulk": "She-Hulk", "doctor-strange": "Doctor Strange" })[id],
    scenarioCardId: (id) => `${id}-1`,
  };
  const games = [
    save("a", 300, {
      config: {
        scenarioId: "rhino",
        difficulty: "standard",
        players: [{ identityCardId: "spider-man", deck: [], aspects: ["justice"] }],
        seed: 1,
      } as never,
    }),
    save("b", 200, {
      status: "lost",
      outcome: { result: "loss", reason: "mainSchemeCompleted" } as never,
      config: {
        scenarioId: "klaw",
        difficulty: "standard",
        players: [{ identityCardId: "doctor-strange", deck: [], deckName: "Sorcerer Supreme" }],
        seed: 1,
      } as never,
    }),
    save("c", 100, {
      config: {
        scenarioId: "rhino",
        difficulty: "standard",
        players: [{ identityCardId: "she-hulk", deck: [] }],
        seed: 1,
      } as never,
    }),
  ];
  const ids = (query: string, filter: "all" | "won" | "lost" = "all"): string[] =>
    pastGameRowsOf(games, names, filter, undefined, query).map((row) => row.id);

  test("an empty or blank search keeps every game, newest first", () => {
    expect(ids("")).toEqual(["a", "b", "c"]);
    expect(ids("   ")).toEqual(["a", "b", "c"]);
  });

  test("a partial hero, villain or deck name narrows the list, ignoring case and accents", () => {
    expect(ids("spid")).toEqual(["a"]);
    expect(ids("RHI")).toEqual(["a", "c"]);
    expect(ids("klaw")).toEqual(["b"]);
    expect(ids("stránge")).toEqual(["b"]);
    expect(ids("sorcerer")).toEqual(["b"]);
    expect(ids("justice")).toEqual(["a"]);
  });

  test("every word must match somewhere, and a typo is forgiven", () => {
    expect(ids("rhino hulk")).toEqual(["c"]);
    expect(ids("rhino klaw")).toEqual([]);
    expect(ids("spidr-man")).toEqual(["a"]);
  });

  test("it combines with the Won and Lost filter, and the tab counts follow it", () => {
    expect(ids("rhino", "won")).toEqual(["a", "c"]);
    expect(ids("klaw", "won")).toEqual([]);
    expect(ids("klaw", "lost")).toEqual(["b"]);
    expect(pastGameCounts(games, undefined, { query: "rhino", names })).toEqual({ all: 2, won: 2, lost: 0 });
    expect(pastGameCounts(games, undefined, { query: "", names })).toEqual({ all: 3, won: 2, lost: 1 });
  });

  test("pastGameMatches reads the names the row shows (a Spanish row matches its Spanish name)", () => {
    const [row] = pastGameRowsOf([games[0]!], { ...names, identityName: () => "Hombre Araña" });
    expect(pastGameMatches(row!, "arana")).toBe(true);
    expect(pastGameMatches(row!, "hulk")).toBe(false);
  });
});

describe("aspect chips on a hero's picture (#911)", () => {
  const pic: Rect = { x: 10, y: 20, width: 46, height: 64 };

  test("no chips without an aspect; custom hero-set aspects and repeats are left out", () => {
    expect(aspectChipsOf(pic, [])).toEqual([]);
    expect(aspectChipsOf(pic, ["hero:spider-ham"])).toEqual([]);
    expect(aspectChipsOf(pic, ["justice", "justice"])).toHaveLength(1);
  });

  test("the chips share the picture's width along its foot, in the deck's order, with the aspect's color", () => {
    const chips = aspectChipsOf({ ...pic, width: 60 }, ["justice", "pool"]);
    expect(chips.map((chip) => chip.stamp.aspect)).toEqual(["justice", "pool"]);
    expect(chips.map((chip) => chip.rect.width)).toEqual([30, 30]);
    for (const chip of chips) {
      expect(chip.rect.y + chip.rect.height).toBe(20 + 64);
      expect(chip.rect.x).toBeGreaterThanOrEqual(10);
      expect(chip.rect.x + chip.rect.width).toBeLessThanOrEqual(70);
    }
  });

  test("a chip always says the aspect in words: the full name when it fits, else a code, else a letter", () => {
    expect(aspectChipsOf({ ...pic, width: 90 }, ["justice"])[0]!.text).toBe("JUSTICE");
    expect(aspectChipsOf(pic, ["aggression"])[0]!.text).toBe("AGG");
    const four = aspectChipsOf(pic, ["aggression", "justice", "protection", "leadership"]);
    expect(four.map((chip) => chip.text)).toEqual(["A", "J", "P", "L"]);
    for (const chip of four) expect(chip.rect.x + chip.rect.width).toBeLessThanOrEqual(pic.x + pic.width + 1e-9);
  });
});

describe("a room guest's finished row (#909)", () => {
  const guest = save("guest", 5, {
    roomPlay: {
      role: "guest",
      roomId: "R".repeat(12),
      gameKey: "room:1",
      mode: "standard",
      mySeats: ["p1"] as never,
      friends: [],
      tookOver: [],
      chatSent: 0,
      strict: false,
      cheats: false,
    },
  });

  test("shows as a finished result, with only the watch, share, export and log actions", () => {
    expect(isPastGame(guest)).toBe(true);
    const [row] = pastGameRowsOf([guest], NAMES);
    expect(row!.result).toBe("won");
    expect([...PAST_GAME_ACTIONS]).toEqual(["watch", "share", "export", "log"]);
    expect(PAST_GAME_ACTIONS.some((action) => /resume|rewind|continue/i.test(action))).toBe(false);
  });
});

describe("aspectBadgesOf (the words each aspect chip can say)", () => {
  test("one badge per aspect the app colours, once each, in the deck's order, with the name, a code and a letter", () => {
    expect(aspectBadgesOf([])).toEqual([]);
    expect(aspectBadgesOf(["hero:spider-ham"])).toEqual([]);
    expect(aspectBadgesOf(["justice", "justice"])).toHaveLength(1);
    expect(aspectBadgesOf(["aggression", "pool"])).toEqual([
      { id: "aggression", full: "AGGRESSION", code: "AGG", letter: "A" },
      { id: "pool", full: "'POOL", code: "'PL", letter: "P" },
    ]);
  });
});
