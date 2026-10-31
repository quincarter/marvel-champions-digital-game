import { describe, expect, test } from "vitest";
import type { DeckInsights } from "../view/deck-insights.js";
import type { StatsNames } from "../view/player-stats-model.js";
import { cardPlaySectionOf, deckInsightsNow } from "./card-play.js";

const NAMES: StatsNames = {
  cardName: (id) => ({ spidey: "Spider-Man (Peter Parker)", webs: "Web-Shooter" })[id],
  cardType: (id) => ({ spidey: "hero_identity", webs: "upgrade", minion: "minion" })[id],
  cardAspect: () => undefined,
  scenarioName: () => undefined,
  starterDeck: () => undefined,
};

const usage = {
  games: 2,
  wins: 1,
  losses: 1,
  lostToScheme: 1,
  lostToWipe: 0,
  tracked: 2,
  inDeck: { webs: 2 },
  usedIn: { webs: 1 },
  wonWith: { webs: 1 },
  damage: 0,
  thwart: 0,
  plays: { webs: 2 },
  activations: {},
};
const INSIGHTS: DeckInsights = { heroes: { spidey: usage }, decks: {}, villains: {} };

describe("cardPlaySectionOf", () => {
  test("a player card: titled with the hero in a game, plainly outside one", () => {
    expect(cardPlaySectionOf(INSIGHTS, "webs", "spidey", NAMES)?.title).toBe("Your play with Spider-Man");
    expect(cardPlaySectionOf(INSIGHTS, "webs", null, NAMES)?.title).toBe("Your play");
    expect(cardPlaySectionOf(INSIGHTS, "webs", null, NAMES)?.lines[0]).toEqual({
      label: "In your deck",
      value: "2 games",
    });
  });

  test("nothing for an encounter card, an identity, or a card never in a deck", () => {
    expect(cardPlaySectionOf(INSIGHTS, "minion", null, NAMES)).toBeNull();
    expect(cardPlaySectionOf(INSIGHTS, "spidey", null, NAMES)).toBeNull();
    expect(cardPlaySectionOf({ heroes: {}, decks: {}, villains: {} }, "webs", null, NAMES)).toBeNull();
  });
});

describe("deckInsightsNow", () => {
  // A stand-in fold: the real one loads the whole pool, which is slow under a full parallel run.
  const fold = async (): Promise<DeckInsights> => ({ heroes: {}, decks: {}, villains: {} });
  test("reuses the fold for 30 s, then reads the saves again", async () => {
    let reads = 0;
    const listSaves = async () => {
      reads++;
      return [];
    };
    await deckInsightsNow(listSaves, 1_000, fold);
    await deckInsightsNow(listSaves, 20_000, fold);
    expect(reads).toBe(1);
    await deckInsightsNow(listSaves, 40_000, fold);
    expect(reads).toBe(2);
  });

  test("a failed read is not kept: the next ask reads again", async () => {
    let reads = 0;
    const failing = async (): Promise<never> => {
      reads++;
      throw new Error("no storage");
    };
    await expect(deckInsightsNow(failing, 1_000_000, fold)).rejects.toThrow("no storage");
    await expect(deckInsightsNow(failing, 1_000_001, fold)).rejects.toThrow("no storage");
    expect(reads).toBe(2);
  });
});
