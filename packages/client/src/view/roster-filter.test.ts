import { describe, expect, test } from "vitest";
import { CORE_SCENARIOS, WAVE1_SCENARIOS, deckFromStarterDeck } from "@mc/content";
import { POOL_CARDS, POOL_STARTER_DECKS } from "../content/pool.js";
import { EMPTY_ROSTER_FILTER, heroRosterMatches, matchesSearch, normalizeSearch, scenarioRosterMatches, type RosterFilter } from "./roster-filter.js";

const CARDS_BY_ID = new Map(POOL_CARDS.map((c) => [c.id as string, c]));

describe("normalizeSearch", () => {
  test("strips accents and lowercases", () => {
    expect(normalizeSearch("Café")).toBe("cafe");
    expect(normalizeSearch("ENERGY")).toBe("energy");
  });
});

describe("matchesSearch", () => {
  test("an empty or blank query matches everything", () => {
    expect(matchesSearch(["Spider-Man"], "")).toBe(true);
    expect(matchesSearch(["Spider-Man"], "   ")).toBe(true);
    expect(matchesSearch([], "")).toBe(true);
  });

  test("matches case- and accent-insensitively, substring anywhere", () => {
    expect(matchesSearch(["Doctor Strange"], "strange")).toBe(true);
    expect(matchesSearch(["Doctor Strange"], "STRANGE")).toBe(true);
    expect(matchesSearch(["Doctor Strange"], "octor str")).toBe(true);
    expect(matchesSearch(["Doctor Strange"], "xyz")).toBe(false);
  });

  test("matches if any haystack matches, and null/undefined entries are skipped", () => {
    expect(matchesSearch([null, undefined, "Justice"], "just")).toBe(true);
    expect(matchesSearch([null, undefined], "just")).toBe(false);
  });
});

describe("heroRosterMatches", () => {
  const spiderMan = deckFromStarterDeck(POOL_STARTER_DECKS.find((d) => (d.id as string) === "core-spider-man-justice")!, "poolv1");
  const spiderManIdentity = CARDS_BY_ID.get(spiderMan.identityCardId as string);
  const capLeadership = deckFromStarterDeck(POOL_STARTER_DECKS.find((d) => (d.id as string) === "cap-leadership")!, "poolv1");
  const capIdentity = CARDS_BY_ID.get(capLeadership.identityCardId as string);

  test("matches the hero's face name", () => {
    expect(heroRosterMatches(spiderMan, spiderManIdentity, { text: "spider-man" })).toBe(true);
  });

  test("matches the alter-ego's face name", () => {
    expect(heroRosterMatches(spiderMan, spiderManIdentity, { text: "peter parker" })).toBe(true);
  });

  test("matches the deck's own name", () => {
    expect(heroRosterMatches(spiderMan, spiderManIdentity, { text: spiderMan.name })).toBe(true);
  });

  test("matches the aspect", () => {
    expect(heroRosterMatches(spiderMan, spiderManIdentity, { text: "justice" })).toBe(true);
    expect(heroRosterMatches(capLeadership, capIdentity, { text: "leadership" })).toBe(true);
  });

  test("matches the source kind (precon)", () => {
    expect(heroRosterMatches(spiderMan, spiderManIdentity, { text: "precon" })).toBe(true);
  });

  test("a wave 1 hero (Captain America) is findable by name, same as a Core one", () => {
    expect(heroRosterMatches(capLeadership, capIdentity, { text: "captain america" })).toBe(true);
  });

  test("no match returns false", () => {
    expect(heroRosterMatches(spiderMan, spiderManIdentity, { text: "doctor strange" })).toBe(false);
  });

  test("empty filter matches every deck", () => {
    expect(heroRosterMatches(spiderMan, spiderManIdentity, EMPTY_ROSTER_FILTER)).toBe(true);
  });
});

describe("scenarioRosterMatches", () => {
  const rhino = CORE_SCENARIOS.find((s) => (s.id as string) === "rhino")!;
  const rhinoVillain = CARDS_BY_ID.get(rhino.villainCardId as string);
  const breakout = WAVE1_SCENARIOS.find((s) => s.multipleVillains)!;

  test("matches the villain's name", () => {
    expect(scenarioRosterMatches(rhino, rhinoVillain, [], { text: "rhino" })).toBe(true);
  });

  test("matches the scenario's own name", () => {
    expect(scenarioRosterMatches(rhino, rhinoVillain, [], { text: rhino.name })).toBe(true);
  });

  test("matches the pack code", () => {
    expect(scenarioRosterMatches(rhino, rhinoVillain, [], { text: rhino.packCode })).toBe(true);
  });

  test("matches an encounter set name passed in", () => {
    expect(scenarioRosterMatches(rhino, rhinoVillain, ["Bomb Scare"], { text: "bomb scare" })).toBe(true);
  });

  test("a wave 1 scenario (Breakout, several villains) is findable too", () => {
    expect(scenarioRosterMatches(breakout, undefined, [], { text: breakout.name })).toBe(true);
  });

  test("no match returns false", () => {
    expect(scenarioRosterMatches(rhino, rhinoVillain, [], { text: "klaw" })).toBe(false);
  });

  test("a filter used as RosterFilter's type works with just text", () => {
    const filter: RosterFilter = { text: "" };
    expect(scenarioRosterMatches(rhino, rhinoVillain, [], filter)).toBe(true);
  });
});
