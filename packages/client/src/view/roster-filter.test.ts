import { describe, expect, test } from "vitest";
import { CORE_SCENARIOS, WAVE1_SCENARIOS, deckFromStarterDeck, type Deck } from "@mc/content";
import { POOL_CARDS, POOL_SCENARIOS, POOL_STARTER_DECKS } from "../content/pool.js";
import {
  EMPTY_ROSTER_FILTER,
  deckSourcesOf,
  heroAspectsOf,
  heroRosterMatches,
  matchesSearch,
  normalizeSearch,
  scenarioProductsOf,
  scenarioRosterMatches,
  withSelectionPinned,
  type RosterFilter,
} from "./roster-filter.js";

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
  const breakoutVillains = breakout.multipleVillains!.villains.map((v) => CARDS_BY_ID.get(v.villainCardId as string));

  test("matches the villain's name", () => {
    expect(scenarioRosterMatches(rhino, [rhinoVillain], [], { text: "rhino" })).toBe(true);
  });

  test("matches the scenario's own name", () => {
    expect(scenarioRosterMatches(rhino, [rhinoVillain], [], { text: rhino.name })).toBe(true);
  });

  test("matches the pack code", () => {
    expect(scenarioRosterMatches(rhino, [rhinoVillain], [], { text: rhino.packCode })).toBe(true);
  });

  test("matches an encounter set name passed in", () => {
    expect(scenarioRosterMatches(rhino, [rhinoVillain], ["Bomb Scare"], { text: "bomb scare" })).toBe(true);
  });

  test("a wave 1 scenario (Breakout, several villains) is findable by its own name", () => {
    expect(scenarioRosterMatches(breakout, breakoutVillains, [], { text: breakout.name })).toBe(true);
  });

  // PLAN.md "Wrecker can't be played from Title": every one of Breakout's four villains has to find the row, not
  // only whichever one `Scenario.villainCardId` happens to name first.
  test("Breakout is findable by any of its four villains, not only the first", () => {
    expect(scenarioRosterMatches(breakout, breakoutVillains, [], { text: "wrecker" })).toBe(true);
    expect(scenarioRosterMatches(breakout, breakoutVillains, [], { text: "thunderball" })).toBe(true);
    expect(scenarioRosterMatches(breakout, breakoutVillains, [], { text: "piledriver" })).toBe(true);
    expect(scenarioRosterMatches(breakout, breakoutVillains, [], { text: "bulldozer" })).toBe(true);
  });

  test("no match returns false", () => {
    expect(scenarioRosterMatches(rhino, [rhinoVillain], [], { text: "klaw" })).toBe(false);
  });

  test("a filter used as RosterFilter's type works with just text", () => {
    const filter: RosterFilter = { text: "" };
    expect(scenarioRosterMatches(rhino, [rhinoVillain], [], filter)).toBe(true);
  });

  test("the product chip narrows to one pack, on top of the text search", () => {
    expect(scenarioRosterMatches(rhino, [rhinoVillain], [], { text: "", product: "core" })).toBe(true);
    expect(scenarioRosterMatches(rhino, [rhinoVillain], [], { text: "", product: "gob" })).toBe(false);
    expect(scenarioRosterMatches(breakout, breakoutVillains, [], { text: breakout.name, product: "gob" })).toBe(false);
  });
});

describe("heroRosterMatches: quick-filter chips", () => {
  const spiderMan = deckFromStarterDeck(POOL_STARTER_DECKS.find((d) => (d.id as string) === "core-spider-man-justice")!, "poolv1");
  const spiderManIdentity = CARDS_BY_ID.get(spiderMan.identityCardId as string);
  const capLeadership = deckFromStarterDeck(POOL_STARTER_DECKS.find((d) => (d.id as string) === "cap-leadership")!, "poolv1");
  const capIdentity = CARDS_BY_ID.get(capLeadership.identityCardId as string);

  test("the aspect chip only shows decks built in that aspect", () => {
    expect(heroRosterMatches(spiderMan, spiderManIdentity, { text: "", aspect: "justice" })).toBe(true);
    expect(heroRosterMatches(spiderMan, spiderManIdentity, { text: "", aspect: "leadership" })).toBe(false);
  });

  test("the source chip only shows decks from that source", () => {
    expect(heroRosterMatches(spiderMan, spiderManIdentity, { text: "", source: "precon" })).toBe(true);
    expect(heroRosterMatches(spiderMan, spiderManIdentity, { text: "", source: "userBuilt" })).toBe(false);
  });

  test("playableOnly hides a deck the caller reports as blocked, without needing to know why", () => {
    expect(heroRosterMatches(spiderMan, spiderManIdentity, { text: "", playableOnly: true }, null)).toBe(true);
    expect(heroRosterMatches(spiderMan, spiderManIdentity, { text: "", playableOnly: true }, "Spider-Man is already at the table")).toBe(false);
    // Off by default: a blocked deck still shows (dimmed, with its reason) unless the chip is on.
    expect(heroRosterMatches(spiderMan, spiderManIdentity, { text: "" }, "Spider-Man is already at the table")).toBe(true);
  });

  test("chips combine with the text search and with each other", () => {
    expect(heroRosterMatches(capLeadership, capIdentity, { text: "captain", aspect: "leadership", source: "precon" })).toBe(true);
    expect(heroRosterMatches(capLeadership, capIdentity, { text: "captain", aspect: "justice" })).toBe(false);
  });
});

describe("heroAspectsOf", () => {
  test("lists only aspects an actual deck uses, in CHOOSABLE_ASPECTS order", () => {
    const decks = POOL_STARTER_DECKS.map((starter) => deckFromStarterDeck(starter, "poolv1"));
    const aspects = heroAspectsOf(decks);
    expect(aspects).toEqual(["aggression", "justice", "leadership", "protection"]);
  });

  test("empty with no decks", () => {
    expect(heroAspectsOf([])).toEqual([]);
  });
});

describe("deckSourcesOf", () => {
  test("precons only: just 'precon'", () => {
    const decks = POOL_STARTER_DECKS.map((starter) => deckFromStarterDeck(starter, "poolv1"));
    expect(deckSourcesOf(decks)).toEqual(["precon"]);
  });

  test("a mix reports every kind present, precon first", () => {
    const precon = deckFromStarterDeck(POOL_STARTER_DECKS[0]!, "poolv1");
    const imported: Deck = { ...precon, id: "d2" as Deck["id"], source: { kind: "imported", site: "marvelcdb", marvelcdbDeckId: null, url: null, importedAt: "now" } };
    const userBuilt: Deck = { ...precon, id: "d3" as Deck["id"], source: { kind: "userBuilt", createdAt: "now" } };
    expect(deckSourcesOf([userBuilt, imported, precon])).toEqual(["precon", "imported", "userBuilt"]);
  });

  test("empty with no decks", () => {
    expect(deckSourcesOf([])).toEqual([]);
  });
});

describe("scenarioProductsOf", () => {
  test("lists every distinct pack code present, in first-seen order, from the app's real scenario pool", () => {
    const products = scenarioProductsOf(POOL_SCENARIOS);
    expect(products).toContain("core");
    expect(products).toContain("gob");
    expect(products).toContain("twc");
    expect(new Set(products).size).toBe(products.length);
  });

  test("empty with no scenarios", () => {
    expect(scenarioProductsOf([])).toEqual([]);
  });
});

describe("withSelectionPinned", () => {
  const items = ["rhino", "klaw", "ultron", "breakout"];
  const isSelected = (item: string) => item === "klaw";

  test("a filter that already includes the selection changes nothing", () => {
    const result = withSelectionPinned(items, (item) => item.includes("l"), isSelected);
    expect(result).toEqual(["klaw", "ultron"]);
  });

  test("a filter that would hide the selection keeps it anyway, in its natural position", () => {
    // PLAN.md: "a Title filter can hide the selected scenario while it stays selected" — a query matching neither
    // Klaw's name nor anything about it must not make the selected row disappear from the roster.
    const result = withSelectionPinned(items, (item) => item.startsWith("b"), isSelected);
    expect(result).toEqual(["klaw", "breakout"]);
  });

  test("nothing selected: behaves like a plain filter", () => {
    const result = withSelectionPinned(items, (item) => item.startsWith("b"), () => false);
    expect(result).toEqual(["breakout"]);
  });

  test("an empty query keeps everything, selection included, with no duplicates", () => {
    const result = withSelectionPinned(items, () => true, isSelected);
    expect(result).toEqual(items);
  });
});
