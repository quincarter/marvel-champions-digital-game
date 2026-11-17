import { describe, expect, test, vi } from "vitest";
import type { CampaignId } from "@mc/content";
import type { SaveMeta } from "../engine/game-storage.js";
import {
  CSV_BOM,
  TRACKER_COLUMNS,
  csvCell,
  marvelcdbLinksOf,
  runTrackerExport,
  trackerCsv,
  trackerFileNameOf,
  trackerRowsOf,
  type TrackerExportNames,
} from "./tracker-export.js";

const FACES: Record<string, { hero: string; alterEgo: string }> = {
  "spider-man": { hero: "Spider-Man", alterEgo: "Peter Parker" },
  "she-hulk": { hero: "She-Hulk", alterEgo: "Jennifer Walters" },
  "black-panther": { hero: "Black Panther", alterEgo: "T'Challa" },
  "pack-hero": { hero: "Quill, Star-Lord", alterEgo: 'Peter "Pete" Quill' },
};
const IDENTITIES: Record<string, string> = {
  "spider-man": "Spider-Man (Peter Parker)",
  "she-hulk": "She-Hulk",
  "black-panther": "Black Panther (T'Challa)",
  "pack-hero": "Quill, Star-Lord",
};
const SETS: Record<string, string> = { bomb_scare: "Bomb Scare", crime: "Crime", "sci-fi": "Sci-Fi" };

const NAMES: TrackerExportNames = {
  scenarioName: (id) => ({ rhino: "Rhino", "pack-villain": "Doom, Inc." })[id],
  identityName: (id) => IDENTITIES[id],
  starterDeckName: (id) => (id === "she-hulk-aggression" ? "She-Hulk — Aggression" : undefined),
  campaignName: (id) => (id === "trors" ? "The Rise of Red Skull" : undefined),
  starterIdentity: (id) => (id === "she-hulk-aggression" ? "she-hulk" : undefined),
  scenarioCardId: (id) => (id === "rhino" ? "rhino-1" : undefined),
  cardName: (id) => (id === "rhino-1" ? "Rhino" : undefined),
  heroFace: (id) => FACES[id],
  setName: (id) => SETS[id],
  defaultSetAsideSets: (id) => (id === "hood" ? ["crime", "sci-fi"] : undefined),
  recommendedSets: (id) =>
    id === "hood" ? [] : id === "rhino" ? ["bomb_scare"] : id === "pack-villain" ? ["crime"] : undefined,
};

// Noon UTC, so the local day is the same in every time zone from -11 to +11.
const DAY = (n: number): number => Date.UTC(2026, 10, n, 12);

const save = (id: string, updatedAt: number, extra: Partial<SaveMeta> = {}): SaveMeta => ({
  id,
  schema: 4,
  config: {
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ identityCardId: "spider-man", deck: [], deckId: "d1", deckName: "Web Slinger" }],
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
  summary: {
    lossReason: null,
    seats: [
      { identityCardId: "spider-man", defeated: false, damage: 1, thwart: 1, aspects: ["justice"], deckId: "d1" },
    ],
  } as never,
  ...extra,
});

const input = (saves: SaveMeta[], extra: object = {}) => ({ saves, names: NAMES, appVersion: "0.47.0", ...extra });
const cellsOf = (saves: SaveMeta[], extra: object = {}) =>
  Object.fromEntries(trackerRowsOf(input(saves, extra))[0]!.cells.map((cell, i) => [TRACKER_COLUMNS[i], cell]));

describe("MC Tracker export rows (#757)", () => {
  test("an adjusted game is left out of the export (issue #791)", () => {
    const rows = trackerRowsOf(
      input([save("a", DAY(3)), save("b", DAY(4), { adjusted: true }), save("c", DAY(5), { status: "lost" })]),
    );
    expect(rows).toHaveLength(2);
  });

  test("a won single-hero game fills every column", () => {
    const links = marvelcdbLinksOf([
      {
        id: "d1",
        source: { kind: "imported", marvelcdbDeckId: "12345", url: "https://marvelcdb.com/decklist/view/12345/x" },
      },
    ]);
    const cells = cellsOf([save("a", DAY(3))], { deckLinks: links });
    expect(cells).toMatchObject({
      Date: "2026-11-03",
      Title: "Rhino — Spider-Man",
      Result: "Win",
      Scenario: "Rhino",
      Villain: "Rhino",
      "Modular sets": "Bomb Scare",
      "Modular sets source": "Recommended",
      "House rules": "",
      Difficulty: "Standard",
      "Heroic level": "0",
      Mode: "",
      Players: "1",
      "Hero 1": "Spider-Man",
      "Identity 1": "Spider-Man (Peter Parker)",
      "Aspects 1": "Justice",
      "Piloted 1": "Yes",
      "Deck 1": "Web Slinger",
      "Decklist 1": "https://marvelcdb.com/decklist/view/12345/x",
      "Hero 2": "",
      "Piloted 2": "",
      Rounds: "6",
      Notes: "Played in Marvel Champions: Digital Edition v0.47.0",
    });
    expect(Object.keys(cells)).toEqual([...TRACKER_COLUMNS]);
  });

  test("a deck without a MarvelCDB source has no link; a link is only ever the recorded URL", () => {
    expect(cellsOf([save("a", DAY(3))])["Decklist 1"]).toBe("");
    expect([
      ...marvelcdbLinksOf([
        { id: "x", source: { kind: "userBuilt" } },
        { id: "y", source: { kind: "imported", marvelcdbDeckId: "9", url: null } },
        { id: "z", source: { kind: "imported", marvelcdbDeckId: null, url: null } },
      ]),
    ]).toEqual([]);
  });

  test("a multi-seat game lists each hero in its slot, a precon by its name, and the shared hero name apart", () => {
    const [cells] = trackerRowsOf(
      input([
        save("m", DAY(4), {
          config: {
            scenarioId: "rhino",
            difficulty: "standard",
            players: [{ starterDeckId: "she-hulk-aggression" }, { identityCardId: "black-panther", deck: [] }],
            seed: 1,
          } as never,
          summary: {
            lossReason: null,
            seats: [
              { identityCardId: "she-hulk", defeated: false, damage: 1, thwart: 1, aspects: ["aggression"] },
              {
                identityCardId: "black-panther",
                defeated: false,
                damage: 1,
                thwart: 1,
                aspects: ["protection", "pool"],
              },
            ],
          } as never,
        }),
      ]),
    ).map((row) => row.cells);
    const byName = Object.fromEntries(cells!.map((cell, i) => [TRACKER_COLUMNS[i], cell]));
    expect(byName).toMatchObject({
      Title: "Rhino — She-Hulk & Black Panther",
      Players: "2",
      "Hero 1": "She-Hulk",
      "Deck 1": "She-Hulk — Aggression",
      "Hero 2": "Black Panther",
      "Identity 2": "Black Panther (T'Challa)",
      "Aspects 2": "Protection; 'Pool",
      "Piloted 2": "Yes",
      "Hero 3": "",
    });
  });

  test("a sat-out seat before another does not shift the later seat's deck or MarvelCDB link", () => {
    const links = new Map([
      ["d1", "https://marvelcdb.com/decklist/view/1"],
      ["d2", "https://marvelcdb.com/decklist/view/2"],
    ]);
    const cells = cellsOf(
      [
        save("s", DAY(4), {
          config: {
            scenarioId: "rhino",
            difficulty: "standard",
            players: [
              { identityCardId: "spider-man", deck: [], deckId: "d1", deckName: "Out" },
              { identityCardId: "she-hulk", deck: [], deckId: "d2", deckName: "In" },
            ],
            seed: 1,
          } as never,
          summary: {
            lossReason: null,
            seats: [
              { identityCardId: "spider-man", defeated: false, damage: 0, thwart: 0, satOut: true, deckId: "d1" },
              { identityCardId: "she-hulk", defeated: false, damage: 1, thwart: 1, deckId: "d2", deckName: "In" },
            ],
          } as never,
        }),
      ],
      { deckLinks: links },
    );
    expect(cells).toMatchObject({
      Players: "1",
      "Hero 1": "She-Hulk",
      "Deck 1": "In",
      "Decklist 1": "https://marvelcdb.com/decklist/view/2",
      "Hero 2": "",
    });
  });

  test("a pack hero and pack scenario export by name, quoted where the name holds commas and quotes", () => {
    const text = trackerCsv(
      input([
        save("p", DAY(5), {
          config: {
            scenarioId: "pack-villain",
            difficulty: "standard",
            players: [{ identityCardId: "pack-hero", deck: [] }],
            seed: 1,
            packs: [{ id: "my-pack", name: "My Pack" }],
          } as never,
          summary: {
            lossReason: null,
            seats: [{ identityCardId: "pack-hero", defeated: false, damage: 0, thwart: 0 }],
          } as never,
        }),
      ]),
    );
    expect(text).toContain('"Doom, Inc. — Quill, Star-Lord"');
    expect(text).toContain(',"Quill, Star-Lord","Quill, Star-Lord",');
    expect(text).toContain(",Crime,Recommended,");
  });

  test("without a summary, a pack precon seat not installed any more keeps its own slot, so the next seat's link stays put", () => {
    const packNames: TrackerExportNames = {
      ...NAMES,
      forPacks: () => ({ ...NAMES, starterIdentity: (id) => (id === "pack-deck" ? "pack-hero" : undefined) }),
    };
    const links = marvelcdbLinksOf([
      { id: "d1", source: { kind: "imported", marvelcdbDeckId: "1", url: "https://marvelcdb.com/decklist/view/1/x" } },
    ]);
    const [row] = trackerRowsOf({
      saves: [
        save("n", DAY(4), {
          config: {
            scenarioId: "rhino",
            difficulty: "standard",
            players: [
              { starterDeckId: "pack-deck" },
              { identityCardId: "spider-man", deck: [], deckId: "d1", deckName: "Web Slinger" },
            ],
            seed: 1,
            packs: [{ id: "my-pack", name: "My Pack" }],
          } as never,
          summary: null,
        }),
      ],
      names: packNames,
      deckLinks: links,
      appVersion: "0.47.0",
    });
    const cells = Object.fromEntries(row!.cells.map((cell, i) => [TRACKER_COLUMNS[i], cell]));
    expect(cells).toMatchObject({ "Hero 1": "Quill, Star-Lord", "Decklist 1": "", "Hero 2": "Spider-Man" });
    expect(cells["Decklist 2"]).toBe("https://marvelcdb.com/decklist/view/1/x");
  });

  test("a loss says why in its notes; a game given up or left unfinished is not exported", () => {
    const lost = save("l", DAY(6), {
      status: "lost",
      outcome: { result: "loss", reason: "mainSchemeCompleted" } as never,
    });
    const conceded = save("c", DAY(7), { status: "abandoned", outcome: { result: "conceded" } as never });
    const unfinished = save("u", DAY(8), { status: "abandoned", outcome: null });
    const rows = trackerRowsOf(input([lost, conceded, unfinished]));
    expect(rows).toHaveLength(1);
    const cells = cellsOf([lost]);
    expect(cells.Result).toBe("Loss");
    expect(cells.Notes).toBe(
      "Played in Marvel Champions: Digital Edition v0.47.0. Lost: the main scheme was completed.",
    );
  });

  test("expert, heroic, skirmish, campaign, chosen modular sets and house rules are marked", () => {
    const cells = cellsOf([
      save("x", DAY(9), {
        campaignId: "trors",
        config: {
          scenarioId: "rhino",
          difficulty: "expert",
          modes: {
            expert: true,
            heroic: 2,
            skirmish: {},
            campaign: { campaignId: "trors" as CampaignId, expertCampaign: true },
          },
          modularSetIds: ["crime", "sci-fi"],
          houseRules: ["gmw"],
          players: [{ identityCardId: "spider-man", deck: [] }],
          packs: [{ id: "gmw", name: "GMW Fixes" }],
          seed: 1,
        } as never,
      }),
    ]);
    expect(cells).toMatchObject({
      Difficulty: "Expert",
      "Heroic level": "2",
      Mode: "Skirmish; Expert Campaign: The Rise of Red Skull",
      "Modular sets": "Crime; Sci-Fi",
      "Modular sets source": "Chosen",
      "House rules": "GMW Fixes",
    });
  });

  test("a plain campaign is not marked expert", () => {
    const cells = cellsOf([
      save("p", DAY(9), {
        campaignId: "trors",
        config: {
          scenarioId: "rhino",
          difficulty: "standard",
          modes: { campaign: { campaignId: "trors" as CampaignId } },
          players: [{ identityCardId: "spider-man", deck: [] }],
          seed: 1,
        } as never,
      }),
    ]);
    expect(cells.Mode).toBe("Campaign: The Rise of Red Skull");
  });

  test("extra and house-rule modular sets are listed and make the source Chosen", () => {
    const withSets = (extra: Record<string, unknown>) =>
      cellsOf([
        save("m", DAY(9), {
          config: {
            scenarioId: "rhino",
            difficulty: "standard",
            players: [{ identityCardId: "spider-man", deck: [] }],
            seed: 1,
            ...extra,
          } as never,
        }),
      ]);
    expect(withSets({})).toMatchObject({ "Modular sets": "Bomb Scare", "Modular sets source": "Recommended" });
    expect(withSets({ extraModularSetIds: ["crime"] })).toMatchObject({
      "Modular sets": "Bomb Scare; Crime",
      "Modular sets source": "Chosen",
    });
    expect(withSets({ modularSetIds: ["bomb_scare"], houseModularSetIds: ["sci-fi"] })).toMatchObject({
      "Modular sets": "Bomb Scare; Sci-Fi (house rule)",
      "Modular sets source": "Chosen",
    });
  });

  test("set-aside modular sets (The Hood, Mojo) are listed, an explicit pick is Chosen, the Hood default is Recommended", () => {
    const game = (scenarioId: string, extra: Record<string, unknown>) =>
      cellsOf([
        save("s", DAY(9), {
          config: {
            scenarioId,
            difficulty: "standard",
            players: [{ identityCardId: "spider-man", deck: [] }],
            seed: 1,
            ...extra,
          } as never,
        }),
      ]);
    expect(game("hood", { setAsideModularSetIds: ["bomb_scare", "crime"] })).toMatchObject({
      "Modular sets": "Bomb Scare (set aside); Crime (set aside)",
      "Modular sets source": "Chosen",
    });
    expect(game("hood", {})).toMatchObject({
      "Modular sets": "Crime (set aside); Sci-Fi (set aside)",
      "Modular sets source": "Recommended",
    });
    // Mojo: its own sets plus the picks set aside; a save with no picks has nothing to list.
    expect(
      game("pack-villain", { modularSetIds: ["crime"], setAsideModularSetIds: ["sci-fi", "bomb_scare"] }),
    ).toMatchObject({
      "Modular sets": "Crime; Sci-Fi (set aside); Bomb Scare (set aside)",
      "Modular sets source": "Chosen",
    });
  });

  test("rows run oldest first", () => {
    const rows = trackerRowsOf(input([save("new", DAY(12)), save("old", DAY(2))]));
    expect(rows.map((row) => row.cells[0])).toEqual(["2026-11-02", "2026-11-12"]);
  });
});

describe("MC Tracker CSV text", () => {
  test("RFC 4180 quoting: commas, quotes and line breaks are quoted with quotes doubled", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
  });

  test("a cell that reads as a spreadsheet formula is defanged", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-1+1")).toBe("'-1+1");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("\tx")).toBe("'\tx");
    expect(csvCell("=a,b")).toBe('"\'=a,b"');
    expect(csvCell("Spider-Man")).toBe("Spider-Man");
  });

  test("the file starts with a UTF-8 byte order mark, a header, and CRLF rows", () => {
    const text = trackerCsv(input([save("a", DAY(3))]));
    expect(text.startsWith(CSV_BOM)).toBe(true);
    const lines = text.slice(1).split("\r\n");
    expect(lines[0]).toBe(TRACKER_COLUMNS.join(","));
    expect(lines).toHaveLength(3);
    expect(lines[2]).toBe("");
    expect(lines[1]).toContain("Rhino — Spider-Man");
  });

  test("no games is a header alone, and the file is named by day", () => {
    expect(trackerCsv(input([])).slice(1)).toBe(`${TRACKER_COLUMNS.join(",")}\r\n`);
    expect(trackerFileNameOf(DAY(16))).toBe("marvel-champions-mc-tracker-2026-11-16.csv");
  });
});

describe("runTrackerExport (#757)", () => {
  const run = (
    isCurrent: () => boolean,
    deliver: (csv: string, name: string) => Promise<unknown>,
    list: () => Promise<[]>,
  ) =>
    runTrackerExport({
      saves: [save("a", DAY(3))],
      names: NAMES,
      listDecks: list,
      isCurrent,
      deliver,
      now: () => DAY(4),
    });

  test("leaving while the deck list is pending delivers nothing", async () => {
    let open = true;
    const deliver = vi.fn(async () => undefined);
    const outcome = await run(
      () => open,
      deliver,
      async () => {
        open = false;
        return [];
      },
    );
    expect(outcome).toEqual({ kind: "left" });
    expect(deliver).not.toHaveBeenCalled();
  });

  test("still on the screen: the CSV is delivered, and a failing deck list still exports", async () => {
    const deliver = vi.fn(async () => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const outcome = await run(
      () => true,
      deliver,
      async () => Promise.reject(new Error("no store")),
    );
    expect(outcome).toEqual({ kind: "done", games: 1 });
    expect(deliver).toHaveBeenCalledTimes(1);
  });
});
