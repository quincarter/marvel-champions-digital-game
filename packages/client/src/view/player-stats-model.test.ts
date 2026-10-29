import { describe, expect, test } from "vitest";
import type { SessionConfig } from "../engine/host.js";
import { SAVE_SCHEMA, type SaveMeta } from "../engine/game-storage.js";
import type { GameSummary, SeatSummary } from "../engine/game-summary.js";
import { playerStatsOf, type StatRow, type StatsNames, type StatsSection } from "./player-stats-model.js";

const CARDS: Record<string, { name: string; type: string; aspect?: string }> = {
  spidey: { name: "Spider-Man", type: "hero_identity" },
  cap: { name: "Captain America", type: "hero_identity" },
  webs: { name: "Web-Shooter", type: "upgrade", aspect: "hero:spidey" },
  aunt: { name: "Aunt May", type: "ally", aspect: "hero:spidey" },
  tac: { name: "Tackle", type: "event", aspect: "aggression" },
  bot: { name: "Interrogation Room", type: "support", aspect: "justice" },
  pss: { name: "Hall of Heroes", type: "player_side_scheme", aspect: "basic" },
  put: { name: "Helicarrier", type: "support", aspect: "basic" },
  energy: { name: "Energy", type: "resource", aspect: "basic" },
  sideA: { name: "Breakin' & Takin'", type: "side_scheme" },
  sideB: { name: "Crowd Control", type: "side_scheme" },
};

const NAMES: StatsNames = {
  cardName: (id) => CARDS[id]?.name,
  cardType: (id) => CARDS[id]?.type,
  cardAspect: (id) => CARDS[id]?.aspect,
  scenarioName: (id) => ({ rhino: "Rhino", klaw: "Klaw" })[id],
  starterDeck: (id) => (id === "spidey-justice" ? { identityCardId: "spidey", aspects: ["justice"] } : undefined),
};

const CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "spidey-justice" }],
  seed: 1,
};

let nextId = 0;
const meta = (overrides: Partial<SaveMeta> = {}): SaveMeta => ({
  id: `g${nextId++}`,
  schema: SAVE_SCHEMA,
  config: CONFIG,
  createdAt: 1,
  updatedAt: nextId,
  status: "won",
  round: 5,
  commandCount: 10,
  outcome: { result: "win", reason: "villainDefeated" },
  campaignId: null,
  campaignNodeId: null,
  ...overrides,
});

const seat = (overrides: Partial<SeatSummary> = {}): SeatSummary => ({
  identityCardId: "spidey",
  aspects: ["justice"],
  deck: ["webs", "aunt", "bot", "energy", "tac"],
  plays: { webs: 1, aunt: 2 },
  activations: { webs: 3, bot: 1 },
  entered: {},
  damage: 10,
  thwart: 6,
  defeated: false,
  ...overrides,
});

const summary = (overrides: Partial<GameSummary> = {}): GameSummary => ({
  lossReason: null,
  heroesDefeated: 0,
  winners: [],
  alliesPlayed: 0,
  seats: [seat()],
  villains: ["Rhino"],
  sideSchemes: { seen: { sideA: 1 }, defeated: { sideA: 1 } },
  ...overrides,
});

const loss = (reason: "schemeCompleted" | "playersDefeated", extra: Partial<SaveMeta> = {}): SaveMeta =>
  meta({
    status: "lost",
    outcome: { result: "loss", reason: reason === "schemeCompleted" ? "mainSchemeCompleted" : "allPlayersDefeated" },
    summary: summary({ lossReason: reason, heroesDefeated: reason === "playersDefeated" ? 1 : 0 }),
    ...extra,
  });

const section = (sections: readonly StatsSection[], id: string): StatsSection => sections.find((s) => s.id === id)!;
const row = (s: StatsSection, id: string): Extract<StatRow, { kind: "stat" }> =>
  s.rows.find((r) => r.id === id) as Extract<StatRow, { kind: "stat" }>;

describe("playerStatsOf: which games count", () => {
  test("no games: an overview with nothing in it, and no other sections", () => {
    const stats = playerStatsOf([], NAMES);
    expect(stats.header.rate).toBe("No games yet");
    expect(stats.sections.map((s) => s.id)).toEqual(["overview"]);
  });

  test("wins and losses count; a game in play, a guided game and a concession do not", () => {
    const stats = playerStatsOf(
      [
        meta({ summary: summary() }),
        loss("schemeCompleted"),
        meta({ status: "active", outcome: null }),
        meta({ guided: { kind: "tutorial" } as never }),
        meta({ status: "abandoned", outcome: { result: "conceded", reason: "conceded" } as never }),
      ],
      NAMES,
    );
    expect(stats.header.record).toBe("1–1");
    expect(stats.header.rate).toBe("50% win rate");
    expect(row(section(stats.sections, "overview"), "ov:conceded").value).toBe("1");
  });

  test("an older save without card numbers counts toward the record and says it is left out of the card lists", () => {
    const stats = playerStatsOf([meta(), meta({ summary: summary() })], NAMES);
    const overview = section(stats.sections, "overview");
    expect(overview.rows.find((r) => r.id === "ov:older")).toBeDefined();
    // The older save's hero still comes from its starter deck.
    expect(row(section(stats.sections, "heroes"), "hero:spidey").value).toBe("2–0");
  });
});

describe("playerStatsOf: streaks and losses", () => {
  test("the best streak and the current one follow the order games finished in", () => {
    const stats = playerStatsOf([meta(), meta(), meta(), loss("schemeCompleted"), meta()], NAMES);
    expect(stats.header.streak).toBe("Best streak 3 · Current: 1 win");
  });

  test("how you lose splits scheme losses from wiped tables", () => {
    const stats = playerStatsOf([loss("schemeCompleted"), loss("schemeCompleted"), loss("playersDefeated")], NAMES);
    const losses = row(section(stats.sections, "overview"), "ov:losses");
    expect(losses.value).toBe("67% scheme");
    expect(losses.detail).toContain("1 to every hero falling");
  });
});

describe("playerStatsOf: villains", () => {
  test("most faced, beaten by most, and won by scheme or by a wiped table", () => {
    const klaw = { ...CONFIG, scenarioId: "klaw" };
    const klawLoss = (reason: "schemeCompleted" | "playersDefeated") =>
      loss(reason, { config: klaw, summary: summary({ lossReason: reason, villains: ["Klaw"] }) });
    const stats = playerStatsOf(
      [
        meta({ summary: summary() }),
        meta({ summary: summary() }),
        meta(),
        klawLoss("playersDefeated"),
        klawLoss("playersDefeated"),
      ],
      NAMES,
    );
    const villains = section(stats.sections, "villains");
    expect(row(villains, "villain:favorite").value).toBe("Rhino");
    expect(row(villains, "villain:nemesis").value).toBe("Klaw");
    expect(row(villains, "villain:wiped").value).toBe("Klaw");
    expect(villains.rows.find((r) => r.id === "villain:scheme")).toBeUndefined();
    // An old save keyed by its scenario's name lands with the new ones keyed by the villain's.
    expect(row(villains, "villain:Rhino").value).toBe("3–0");
  });
});

describe("playerStatsOf: villains named two ways", () => {
  test("an older save named by its scenario and a newer one named by its villains share one row", () => {
    const crew = { ...CONFIG, scenarioId: "crew" };
    const stats = playerStatsOf(
      [
        meta({ config: crew, updatedAt: 1 }),
        meta({ config: crew, updatedAt: 9, summary: summary({ villains: ["Wrecker", "Thunderball"] }) }),
      ],
      NAMES,
    );
    const villains = section(stats.sections, "villains");
    expect(row(villains, "villain:Wrecker & Thunderball").value).toBe("2–0");
    expect(villains.rows.filter((r) => r.id.startsWith("villain:") && r.id !== "villain:favorite")).toHaveLength(1);
  });
});

describe("playerStatsOf: side schemes", () => {
  test("seen most, hardest to clear, and a row per scheme", () => {
    const stats = playerStatsOf(
      [
        meta({ summary: summary({ sideSchemes: { seen: { sideA: 2, sideB: 1 }, defeated: { sideA: 2 } } }) }),
        meta({ summary: summary({ sideSchemes: { seen: { sideB: 2 }, defeated: { sideB: 1 } } }) }),
      ],
      NAMES,
    );
    const side = section(stats.sections, "side-schemes");
    expect(row(side, "side:common").value).toBe("Crowd Control");
    expect(row(side, "side:hardest").value).toBe("Crowd Control");
    expect(row(side, "side:sideA").detail).toBe("Cleared 2 (100%)");
  });
});

describe("playerStatsOf: cards by hero", () => {
  const stats = playerStatsOf(
    [
      meta({ summary: summary() }),
      meta({ summary: summary({ seats: [seat({ plays: { webs: 2, tac: 1 }, activations: { bot: 2 } })] }) }),
      meta({ summary: summary({ seats: [seat({ identityCardId: "cap", aspects: ["leadership"] })] }) }),
    ],
    NAMES,
  );
  const cards = section(stats.sections, "cards:spidey");

  test("a section per hero, most played first", () => {
    expect(stats.sections.filter((s) => s.id.startsWith("cards:")).map((s) => s.id)).toEqual([
      "cards:spidey",
      "cards:cap",
    ]);
    expect(cards.title).toBe("Spider-Man · cards");
  });

  test("most played supports and upgrades sum plays across games", () => {
    expect(row(cards, "spidey:su:webs").value).toBe("3×");
    expect(row(cards, "spidey:su:webs").detail).toBe("Played in 2 of 2 games");
    expect(cards.rows.find((r) => r.id === "spidey:su:aunt")).toBeUndefined();
    expect(row(cards, "spidey:ally:aunt").value).toBe("2×");
  });

  test("most activated cards, and the aspect cards among them", () => {
    expect(row(cards, "spidey:act:webs").value).toBe("3×");
    expect(row(cards, "spidey:aact:bot").value).toBe("3×");
    expect(cards.rows.find((r) => r.id === "spidey:aact:webs")).toBeUndefined();
  });

  test("rarely played lists cards played in under half their games, never resources", () => {
    const unplayed = cards.rows.filter((r) => r.id.startsWith("spidey:unplayed:") && r.kind === "stat");
    // Energy was never played but is a resource; Tackle was played in one game of two, which is not rare.
    expect(unplayed.map((r) => r.id)).toEqual(["spidey:unplayed:bot"]);
    expect(row(cards, "spidey:unplayed:bot").value).toBe("never");
  });

  test("a card put into play without being played is not rare; a player side scheme is never listed", () => {
    const put = playerStatsOf(
      [meta({ summary: summary({ seats: [seat({ deck: ["put", "pss", "bot"], plays: {}, entered: { put: 1 } })] }) })],
      NAMES,
    );
    const ids = section(put.sections, "cards:spidey").rows.map((r) => r.id);
    expect(ids).toContain("spidey:unplayed:bot");
    expect(ids).not.toContain("spidey:unplayed:put");
    expect(ids).not.toContain("spidey:unplayed:pss");
  });

  test("the favorite aspect is the one played in most games", () => {
    expect(row(cards, "spidey:aspect:justice").label).toBe("Favorite aspect");
    expect(row(cards, "spidey:aspect:justice").value).toBe("Justice");
  });

  test("the hero list names the favorite and gives each hero its numbers", () => {
    const heroes = section(stats.sections, "heroes");
    expect(row(heroes, "hero:favorite").value).toBe("Spider-Man");
    expect(row(heroes, "hero:spidey").detail).toContain("10.0 damage, 6.0 thwart a game");
  });
});

describe("playerStatsOf: the dashboard's Overview tiles", () => {
  test("the record, how you lose, per-game figures, the favorite hero and the villains with their art", () => {
    const klaw = { ...CONFIG, scenarioId: "klaw" };
    const stats = playerStatsOf(
      [
        meta({ summary: summary() }),
        meta({ summary: summary() }),
        loss("schemeCompleted"),
        loss("playersDefeated", {
          config: klaw,
          summary: summary({ lossReason: "playersDefeated", villains: ["Klaw"] }),
        }),
      ],
      NAMES,
    );
    const tiles = new Map(stats.overview.tiles.map((t) => [t.id, t]));
    expect(tiles.get("record")).toMatchObject({ kind: "record", record: "2–2" });
    expect(tiles.get("lose")).toMatchObject({
      kind: "split",
      parts: [
        { label: "Scheme", count: 1 },
        { label: "Wiped", count: 1 },
      ],
    });
    expect(tiles.get("per-game")).toMatchObject({ kind: "figures" });
    expect(tiles.get("hero")).toMatchObject({ kind: "portrait", name: "Spider-Man", art: { hero: "spidey" } });
    // Klaw is also the one that wiped the table: a villain gets one tile.
    expect(tiles.get("villain:nemesis")).toMatchObject({ kind: "portrait", name: "Klaw", art: { scenario: "klaw" } });
    expect(tiles.get("villain:wiped")).toBeUndefined();
    expect(tiles.get("aspect")).toMatchObject({ kind: "small", value: "Justice" });
  });
});

describe("playerStatsOf: the Cards by hero tab", () => {
  test("each hero's aspects and card groups, most played hero first", () => {
    const stats = playerStatsOf(
      [
        meta({ summary: summary() }),
        meta({ summary: summary({ seats: [seat({ identityCardId: "cap", aspects: ["leadership"] })] }) }),
        meta({ summary: summary() }),
      ],
      NAMES,
    );
    expect(stats.heroCards.map((h) => h.identityCardId)).toEqual(["spidey", "cap"]);
    const spidey = stats.heroCards[0]!;
    expect(spidey.aspects[0]).toMatchObject({ aspect: "justice", label: "Justice" });
    const su = spidey.groups.find((g) => g.id === "spidey:su")!;
    expect(su.title).toBe("Most played supports and upgrades");
    expect(su.cards[0]).toMatchObject({ cardId: "webs", value: "2×" });
    expect(spidey.groups.find((g) => g.id === "spidey:unplayed")?.cards.map((c) => c.cardId)).toEqual(["bot", "tac"]);
  });

  test("a hero with only older games has a note and no groups", () => {
    const stats = playerStatsOf([meta()], NAMES);
    expect(stats.heroCards[0]!.groups).toEqual([]);
    expect(stats.heroCards[0]!.note).toContain("next game");
  });
});

describe("playerStatsOf: devices", () => {
  test("games by the device they were last played on, when any save says", () => {
    const on = (platform: "windows" | "android", status: "won" | "lost" = "won") =>
      meta({
        status,
        lastPlayedOn: { platform },
        ...(status === "lost" ? { outcome: { result: "loss", reason: "mainSchemeCompleted" } } : {}),
      });
    const stats = playerStatsOf([on("windows"), on("windows", "lost"), on("android"), meta()], NAMES);
    const devices = section(stats.sections, "devices");
    expect(row(devices, "device:most").value).toBe("Windows");
    expect(row(devices, "device:windows").value).toBe("1–1");
    expect(row(devices, "device:android").value).toBe("1–0");
    expect(devices.rows.find((r) => r.id === "device:unstamped")).toBeDefined();
  });

  test("no Devices section when no save says where it was played", () => {
    expect(playerStatsOf([meta()], NAMES).sections.find((s) => s.id === "devices")).toBeUndefined();
  });
});
