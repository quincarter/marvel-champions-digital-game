import { describe, expect, test } from "vitest";
import {
  deckCountTagOf,
  groupShelvesByHero,
  heroDeckRowOf,
  heroGroupKeyOf,
  heroPacksOf,
  type HeroDeckRowFacts,
} from "./hero-deck-groups.js";
import { azShelvesOf, cycleShelvesOf, type Shelf, type ShelfCandidate, type ShelfPack } from "./roster-shelves.js";

interface Deck {
  readonly id: string;
  readonly hero: string;
  readonly name: string;
  readonly pack: string | null;
}

const deck = (id: string, hero: string, name: string, pack: string | null = null): Deck => ({ id, hero, name, pack });
const heroOf = (d: Deck): string => d.hero;
const shelf = (id: string, items: readonly Deck[]): Shelf<Deck> => ({ id, title: id, items });

describe("groupShelvesByHero", () => {
  const lead = deck("lead", "cm", "Captain Marvel Leadership", "core");
  const aggr = deck("aggr", "cm", "Captain Marvel Aggression", "core");
  const spider = deck("spider", "sm", "Spider-Man", "core");

  test("collapses a hero's decks to one tile at the first deck's place", () => {
    const { shelves, groups } = groupShelvesByHero([shelf("core", [lead, spider, aggr])], heroOf);
    expect(shelves[0]!.items.map((d) => d.id)).toEqual(["lead", "spider"]);
    expect(groups.get("cm")!.decks.map((d) => d.id)).toEqual(["lead", "aggr"]);
    expect(groups.get("sm")!.decks).toHaveLength(1);
  });

  test("a hero split across shelves keeps one tile on the first and all its decks", () => {
    const mine = deck("mine", "cm", "My Marvel");
    const { shelves, groups } = groupShelvesByHero([shelf("core", [lead]), shelf("yours", [mine, spider])], heroOf);
    expect(shelves.map((s) => s.items.map((d) => d.id))).toEqual([["lead"], ["spider"]]);
    expect(groups.get("cm")!.decks.map((d) => d.id)).toEqual(["lead", "mine"]);
  });

  test("a shelf left with no tile is dropped", () => {
    const { shelves } = groupShelvesByHero([shelf("core", [lead]), shelf("yours", [aggr])], heroOf);
    expect(shelves.map((s) => s.id)).toEqual(["core"]);
  });

  test("the best-ranked deck stands for the tile, the first on a tie", () => {
    const rank = (d: Deck): number => (d.id === "aggr" ? 2 : 0);
    expect(groupShelvesByHero([shelf("core", [lead, aggr])], heroOf, rank).groups.get("cm")!.rep.id).toBe("aggr");
    expect(groupShelvesByHero([shelf("core", [lead, aggr])], heroOf).groups.get("cm")!.rep.id).toBe("lead");
  });

  test("a filter that leaves one deck of a hero leaves a one-deck group", () => {
    const { groups } = groupShelvesByHero([shelf("core", [aggr, spider])], heroOf);
    expect(groups.get("cm")!.decks).toHaveLength(1);
  });

  test("works over the real shelf builders: by wave and A-Z", () => {
    const mine = deck("mine", "cm", "My Marvel");
    const packs: readonly ShelfPack[] = [
      { code: "core", cycleId: "c0", cycleName: "Core", cycleOrder: 0 },
      { code: "w1", cycleId: "c1", cycleName: "Wave 1", cycleOrder: 1 },
    ];
    const heroPacks = heroPacksOf([lead, aggr, spider, mine], heroOf, (d) => d.pack);
    const candidates: ShelfCandidate<Deck>[] = [lead, aggr, spider, mine].map((d) => ({
      item: d,
      packCode: heroPacks.get(d.hero) ?? null,
      searchHaystacks: [d.name],
      passesChips: true,
    }));
    const wave = groupShelvesByHero(cycleShelvesOf(candidates, packs, ""), heroOf);
    expect(wave.shelves.map((s) => s.id)).toEqual(["c0"]);
    expect(wave.shelves[0]!.items).toHaveLength(2);
    expect(wave.groups.get("cm")!.decks.map((d) => d.id)).toEqual(["lead", "aggr", "mine"]);

    // A search that only "My Marvel" matches still shows the hero, with one deck.
    const mineOnly = groupShelvesByHero(cycleShelvesOf(candidates, packs, "my marvel"), heroOf);
    expect(mineOnly.shelves[0]!.items.map((d) => d.hero)).toEqual(["cm"]);
    expect(mineOnly.groups.get("cm")!.decks.map((d) => d.id)).toEqual(["mine"]);

    const az = groupShelvesByHero(
      azShelvesOf(
        candidates,
        "",
        (d) => d.hero,
        (d) => d.name,
      ),
      heroOf,
    );
    expect(az.shelves.map((s) => s.title)).toEqual(["C", "S"]);
  });
});

describe("heroPacksOf", () => {
  test("a hero's pack is its precon's, whatever order its other decks arrive in", () => {
    const mine = deck("mine", "cm", "My Marvel");
    const lead = deck("lead", "cm", "Leadership", "core");
    const packs = heroPacksOf([mine, lead], heroOf, (d) => d.pack);
    expect(packs.get("cm")).toBe("core");
  });

  test("a hero with no precon has no pack", () => {
    expect(heroPacksOf([deck("mine", "x", "Mine")], heroOf, (d) => d.pack).has("x")).toBe(false);
  });
});

describe("deckCountTagOf", () => {
  test("only a hero with several decks is tagged", () => {
    expect(deckCountTagOf(1)).toBeNull();
    expect(deckCountTagOf(2)).toBe("2 DECKS");
  });

  test("decks beyond the precons are counted on their own", () => {
    expect(deckCountTagOf(3, 2)).toBe("+2 DECKS");
    expect(deckCountTagOf(2, 1)).toBe("+1 DECK");
  });
});

describe("heroGroupKeyOf", () => {
  test("no search groups by hero; a search gives every deck its own card", () => {
    expect(heroGroupKeyOf(false, "cm", "d1")).toBe("cm");
    expect(heroGroupKeyOf(true, "cm", "d1")).toBe("d1");
  });

  test("grouping under deck keys leaves one tile per matching deck", () => {
    const a = deck("a", "cm", "A");
    const b = deck("b", "cm", "B");
    const keyOf = (d: Deck): string => heroGroupKeyOf(true, d.hero, d.id);
    const { shelves, groups } = groupShelvesByHero([shelf("core", [a, b])], keyOf);
    expect(shelves[0]!.items.map((d) => d.id)).toEqual(["a", "b"]);
    expect(groups.get("a")!.decks).toHaveLength(1);
  });
});

describe("heroDeckRowOf", () => {
  const base: HeroDeckRowFacts = {
    deckId: "d",
    name: "Captain Marvel",
    sourceKind: "precon",
    testedCredit: null,
    cardCount: 40,
    blockedBy: null,
    lock: null,
    warning: null,
    activeSeat: false,
    otherSeat: null,
  };

  test("a legal deck says so and can be seated", () => {
    expect(heroDeckRowOf(base)).toMatchObject({
      source: "Precon",
      cards: "40 cards",
      status: "Legal",
      statusKind: "ok",
      action: "Seat",
      enabled: true,
    });
  });

  test("sources are worded for the player", () => {
    expect(heroDeckRowOf({ ...base, sourceKind: "imported" }).source).toBe("Imported");
    expect(heroDeckRowOf({ ...base, sourceKind: "userBuilt" }).source).toBe("Built");
    expect(heroDeckRowOf({ ...base, sourceKind: "imported", testedCredit: "by andyr · MarvelCDB" }).source).toBe(
      "Tested · by andyr · MarvelCDB",
    );
  });

  test("a warning is shown in words and does not block", () => {
    expect(heroDeckRowOf({ ...base, warning: "Partly playable" })).toMatchObject({
      status: "Partly playable",
      statusKind: "warning",
      enabled: true,
    });
  });

  test("a blocked deck cannot be seated and says why", () => {
    expect(heroDeckRowOf({ ...base, blockedBy: "Deck has 39 cards" })).toMatchObject({
      status: "Deck has 39 cards",
      statusKind: "blocked",
      enabled: false,
    });
  });

  test("a locked deck stays pressable and offers the unlock", () => {
    expect(heroDeckRowOf({ ...base, lock: "Beat Rhino" })).toMatchObject({
      statusKind: "locked",
      action: "Unlock",
      enabled: true,
    });
  });

  test("the active seat's deck reads Seated; another seat's reads its seat number", () => {
    expect(heroDeckRowOf({ ...base, activeSeat: true, otherSeat: 1 })).toMatchObject({
      action: "Seated",
      enabled: false,
    });
    expect(heroDeckRowOf({ ...base, otherSeat: 2, blockedBy: "already at the table" })).toMatchObject({
      status: "In seat 2",
      enabled: false,
    });
  });

  test("a single card is not 'cards'", () => {
    expect(heroDeckRowOf({ ...base, cardCount: 1 }).cards).toBe("1 card");
  });
});
