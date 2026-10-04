import { describe, expect, test } from "vitest";
import type { Deck } from "@mc/content";
import { CARDS_BY_ID, POOL_VERSION } from "../content/pool.js";
import { preconDecks } from "./deck-list-model.js";
import { analyzeSeatCandidates, pairCatalogOf, seatedTeamUps, topRecommendations } from "./seat-recommendations.js";

const catalog = pairCatalogOf(CARDS_BY_ID);
const precons = preconDecks(POOL_VERSION);
const deck = (slug: string): Deck => precons.find((d) => (d.id as string) === `precon:${slug}`)!;
const analyze = (seats: (Deck | null)[], candidates: readonly Deck[] = precons) =>
  analyzeSeatCandidates(seats, candidates, CARDS_BY_ID, catalog);
/** Rogue wearing Gambit's aspect, so the pair is the only thing that recommends her. */
const rogueInJustice = (): Deck => ({ ...deck("rogue-protection"), aspects: ["justice"] });
const idOf = (slug: string): string => deck(slug).id as string;

/** The deck with every Team-Up card for any pair removed: an imported list that left them out. */
const withoutTeamUpCards = (source: Deck): Deck => ({
  ...source,
  cards: source.cards.filter((entry) => {
    const card = CARDS_BY_ID.get(entry.cardId as string);
    return !(card && "keywords" in card && card.keywords.some((k) => k.name === "teamUp"));
  }),
});

describe("seatedTeamUps", () => {
  test("two seated heroes that form a pair, in alter-ego form at seat time, are one marker", () => {
    const pairs = seatedTeamUps([deck("colossus-protection"), deck("shadowcat-aggression")], CARDS_BY_ID, catalog);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.label).toBe("Team-Up: Colossus and Shadowcat");
    expect(pairs[0]!.seats).toEqual([1, 2]);
  });

  test("an unrelated table has none, and an empty seat is skipped", () => {
    expect(
      seatedTeamUps([deck("core-spider-man-justice"), null, deck("storm-leadership")], CARDS_BY_ID, catalog),
    ).toEqual([]);
  });

  test("every pair at a bigger table gets its own marker", () => {
    const pairs = seatedTeamUps(
      [deck("gambit-justice"), deck("colossus-protection"), deck("rogue-protection"), deck("shadowcat-aggression")],
      CARDS_BY_ID,
      catalog,
    );
    expect(pairs.map((p) => p.pair.key).sort()).toEqual(["colossus-shadowcat", "gambit-rogue"]);
    expect(pairs.find((p) => p.pair.key === "gambit-rogue")!.seats).toEqual([1, 3]);
  });

  test("it reports which seated decks hold a Team-Up card", () => {
    const [pair] = seatedTeamUps([deck("gambit-justice"), deck("rogue-protection")], CARDS_BY_ID, catalog);
    expect(pair!.cardNames).toEqual(["Beauty and the Thief"]);
    expect(pair!.inDecks.map((d) => d.seat)).toEqual([1, 2]);
  });
});

describe("analyzeSeatCandidates", () => {
  test("nobody seated: nothing to analyze, nothing recommended", () => {
    expect(analyze([null, null]).size).toBe(0);
    expect(
      topRecommendations(
        analyze([]),
        precons.map((d) => d.id as string),
        6,
      ),
    ).toEqual([]);
  });

  test("a hero already seated is excluded", () => {
    const result = analyze([deck("gambit-justice")]);
    expect(result.has(idOf("gambit-justice"))).toBe(false);
  });

  test("Phoenix seated: Cyclops and Storm are Team-Up partners, named with the Phoenix seat", () => {
    const result = analyze([deck("phoenix-justice")]);
    for (const slug of ["cyclops-leadership", "storm-leadership"]) {
      const rec = result.get(idOf(slug))!;
      expect(rec.teamUps.map((t) => t.partner)).toEqual(["Phoenix"]);
      expect(rec.teamUps[0]!.partnerSeat).toBe(1);
      expect(rec.reason).toContain("Team-Up with Phoenix");
    }
  });

  test("Team-Up partners rank above aspect-only candidates", () => {
    const order = precons.map((d) => d.id as string);
    const top = topRecommendations(analyze([deck("phoenix-justice")]), order, 6);
    expect(top.slice(0, 2).every((rec) => rec.teamUps.length > 0)).toBe(true);
    expect(top.length).toBeLessThanOrEqual(6);
    expect(top.some((rec) => rec.teamUps.length === 0 && rec.addsAspects.length > 0)).toBe(true);
  });

  test("Colossus seated: Shadowcat and Wolverine both list Colossus", () => {
    const result = analyze([deck("colossus-protection")]);
    expect(result.get(idOf("shadowcat-aggression"))!.teamUps.map((t) => t.partner)).toEqual(["Colossus"]);
    expect(result.get(idOf("wolverine-aggression"))!.teamUps.map((t) => t.partner)).toEqual(["Colossus"]);
  });

  test("a candidate that pairs with two seated heroes lists each partner", () => {
    const rec = analyze([deck("shadowcat-aggression"), deck("wolverine-aggression")]).get(idOf("colossus-protection"))!;
    expect(rec.teamUps.map((t) => t.partner).sort()).toEqual(["Shadowcat", "Wolverine"]);
    expect(rec.reason).toMatch(/^Team-Up with Shadowcat and Wolverine/);
  });

  test("the Team-Up card in both decks is said so", () => {
    const rogue = rogueInJustice();
    const rec = analyze([deck("gambit-justice")], [rogue]).get(rogue.id as string)!;
    expect(rec.teamUps[0]!.cardNames).toEqual(["Beauty and the Thief"]);
    expect(rec.teamUps[0]!.inDecks.map((c) => c.seat)).toEqual([1, null]);
    expect(rec.reason).toBe("Team-Up with Gambit · Beauty and the Thief is in both decks");
  });

  test("an imported deck without the Team-Up card says neither deck includes it", () => {
    const bare = withoutTeamUpCards(deck("gambit-justice"));
    const rogue = withoutTeamUpCards(rogueInJustice());
    const rec = analyze([bare], [rogue]).get(rogue.id as string)!;
    expect(rec.reason).toBe("Team-Up with Gambit · neither deck includes the Team-Up card");
    const one = analyze([bare], [rogueInJustice()]).get(idOf("rogue-protection"))!;
    expect(one.reason).toBe("Team-Up with Gambit · Beauty and the Thief is only in Rogue's deck");
  });

  test("aspect coverage: a deck with a new aspect is recommended with the table's aspects named", () => {
    const rec = analyze([deck("core-spider-man-justice"), deck("core-black-panther-protection")]).get(
      idOf("core-iron-man-aggression"),
    )!;
    expect(rec.teamUps).toEqual([]);
    expect(rec.addsAspects).toEqual(["aggression"]);
    expect(rec.reason).toBe("Adds Aggression · the table has Justice and Protection");
  });

  test("a deck bringing nothing new is not recommended", () => {
    const rec = analyze([deck("core-spider-man-justice")]).get(idOf("spiderham-justice"))!;
    expect(rec.score).toBe(0);
    expect(rec.reason).toBe("");
    expect(topRecommendations(analyze([deck("core-spider-man-justice")]), [idOf("spiderham-justice")], 6)).toEqual([]);
  });

  test("a Team-Up partner that also adds an aspect says both", () => {
    const rec = analyze([deck("gambit-justice")]).get(idOf("rogue-protection"))!;
    expect(rec.addsAspects).toEqual(["protection"]);
    expect(rec.reason).toBe("Team-Up with Gambit, and adds Protection");
    expect(rec.lines).toHaveLength(2);
  });
});
