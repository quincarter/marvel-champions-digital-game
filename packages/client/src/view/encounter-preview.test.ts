import { describe, expect, test } from "vitest";
import { CORE_CARDS, CORE_ENCOUNTER_SETS, WAVE1_CARDS, WAVE1_ENCOUNTER_SETS } from "@mc/content";
import { coreScenario, wave1Scenario } from "@mc/cards";
import { encounterDeckPreviewOf } from "./encounter-preview.js";

describe("encounterDeckPreviewOf: a Core scenario (Rhino)", () => {
  const config = coreScenario("rhino", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 2026 });
  const preview = encounterDeckPreviewOf(config, CORE_CARDS, CORE_ENCOUNTER_SETS);

  test("one deck, matching the config's own encounterDeck exactly", () => {
    expect(preview.decks).toHaveLength(1);
    const deck = preview.decks[0]!;
    expect(deck.villainCardId).toBe(config.villainCardId);
    expect(deck.villainName).toBe("Rhino");
    expect(deck.totalCards).toBe(config.encounterDeck.length);
  });

  test("bySet and byType both sum to the deck's total (no card falls through unclassified)", () => {
    const deck = preview.decks[0]!;
    expect(deck.bySet.reduce((sum, b) => sum + b.cardCount, 0)).toBe(deck.totalCards);
    expect(deck.byType.reduce((sum, b) => sum + b.count, 0)).toBe(deck.totalCards);
    // Every set named is a real Core encounter set, not a raw id fallback.
    for (const bucket of deck.bySet) expect(bucket.setName).not.toBe(bucket.setId);
  });

  test("includes Rhino's own set, the recommended modular (Bomb Scare, since none was chosen) and the standard set", () => {
    const deck = preview.decks[0]!;
    const setIds = deck.bySet.map((b) => b.setId);
    expect(setIds).toContain("rhino");
    expect(setIds).toContain("bomb_scare");
    expect(setIds).toContain("standard");
  });

  test("Spider-Man's obligation is shuffled in and his nemesis set is held back", () => {
    expect(preview.obligationsShuffledIn).toEqual([
      { identityCardId: "01001a", heroName: "Spider-Man", obligationCardId: "01165", obligationName: "Eviction Notice" },
    ]);
    expect(preview.nemesisSetsHeldBack).toHaveLength(1);
    const nemesis = preview.nemesisSetsHeldBack[0]!;
    expect(nemesis.heroName).toBe("Spider-Man");
    expect(nemesis.setId).toBe("spider_man_nemesis");
    expect(nemesis.setName).toBe("Spider-Man Nemesis");
    expect(nemesis.cardCount).toBeGreaterThan(0);
  });

  test("a scenario with two seats reports one obligation/nemesis pair per hero", () => {
    const twoPlayer = coreScenario("rhino", { players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-black-panther-protection" }], seed: 1 });
    const twoPlayerPreview = encounterDeckPreviewOf(twoPlayer, CORE_CARDS, CORE_ENCOUNTER_SETS);
    expect(twoPlayerPreview.obligationsShuffledIn).toHaveLength(2);
    expect(twoPlayerPreview.nemesisSetsHeldBack).toHaveLength(2);
    expect(twoPlayerPreview.obligationsShuffledIn.map((o) => o.heroName).sort()).toEqual(["Black Panther", "Spider-Man"]);
  });
});

describe("encounterDeckPreviewOf: a single-villain wave 1 scenario (Risky Business)", () => {
  const config = wave1Scenario("risky-business", { players: [{ starterDeckId: "cap-leadership" }], seed: 7 });
  const preview = encounterDeckPreviewOf(config, WAVE1_CARDS, WAVE1_ENCOUNTER_SETS);

  test("one deck, breakdowns sum to the total, and the identity's obligation/nemesis still show", () => {
    expect(preview.decks).toHaveLength(1);
    const deck = preview.decks[0]!;
    expect(deck.totalCards).toBe(config.encounterDeck.length);
    expect(deck.bySet.reduce((sum, b) => sum + b.cardCount, 0)).toBe(deck.totalCards);
    expect(deck.byType.reduce((sum, b) => sum + b.count, 0)).toBe(deck.totalCards);
    expect(preview.obligationsShuffledIn).toHaveLength(1);
    expect(preview.obligationsShuffledIn[0]!.heroName).toBe("Captain America");
    expect(preview.nemesisSetsHeldBack).toHaveLength(1);
  });
});

describe("encounterDeckPreviewOf: Breakout (multiple villains, no obligations/nemesis)", () => {
  const config = wave1Scenario("breakout", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 41 });
  const preview = encounterDeckPreviewOf(config, WAVE1_CARDS, WAVE1_ENCOUNTER_SETS);

  test("one deck per villain, in printed order, each a real 15-card encounter deck", () => {
    expect(preview.decks.map((d) => d.villainName)).toEqual(["Wrecker", "Thunderball", "Piledriver", "Bulldozer"]);
    for (const [index, deck] of preview.decks.entries()) {
      expect(deck.totalCards).toBe(config.villains![index]!.encounterDeck.length);
      expect(deck.bySet.reduce((sum, b) => sum + b.cardCount, 0)).toBe(deck.totalCards);
      expect(deck.byType.reduce((sum, b) => sum + b.count, 0)).toBe(deck.totalCards);
    }
  });

  test("no obligations or nemesis sets — The Wrecking Crew insert turns both off", () => {
    expect(preview.obligationsShuffledIn).toEqual([]);
    expect(preview.nemesisSetsHeldBack).toEqual([]);
  });
});
