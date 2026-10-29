import { describe, expect, test } from "vitest";
import type { SessionConfig } from "../engine/host.js";
import { SAVE_SCHEMA, type SaveMeta } from "../engine/game-storage.js";
import type { GameSummary, SeatSummary } from "../engine/game-summary.js";
import type { StatsNames } from "./player-stats-model.js";
import { deckInsightsOf, deckPlayOf, fromYourGamesOf } from "./deck-insights.js";

const CARDS: Record<string, { name: string; type: string; aspect?: string }> = {
  spidey: { name: "Spider-Man (Peter Parker)", type: "hero_identity" },
  webs: { name: "Web-Shooter", type: "upgrade", aspect: "hero:spidey" },
  aunt: { name: "Aunt May", type: "ally", aspect: "hero:spidey" },
  bot: { name: "Interrogation Room", type: "support", aspect: "justice" },
  tac: { name: "Tackle", type: "event", aspect: "aggression" },
  first: { name: "First Aid", type: "event", aspect: "basic" },
  energy: { name: "Energy", type: "resource", aspect: "basic" },
};

const NAMES: StatsNames = {
  cardName: (id) => CARDS[id]?.name,
  cardType: (id) => CARDS[id]?.type,
  cardAspect: (id) => CARDS[id]?.aspect,
  scenarioName: () => "Rhino",
  starterDeck: (id) => (id === "spidey-justice" ? { identityCardId: "spidey", aspects: ["justice"] } : undefined),
};

const CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "spidey-justice" }],
  seed: 1,
};

let id = 0;
const seat = (overrides: Partial<SeatSummary> = {}): SeatSummary => ({
  identityCardId: "spidey",
  aspects: ["justice"],
  deck: ["webs", "aunt", "bot", "energy"],
  plays: { webs: 2 },
  activations: {},
  entered: {},
  damage: 10,
  thwart: 4,
  defeated: false,
  ...overrides,
});
const game = (won: boolean, s: SeatSummary = seat(), extra: Partial<SaveMeta> = {}): SaveMeta => {
  const summary: GameSummary = {
    lossReason: won ? null : "schemeCompleted",
    heroesDefeated: 0,
    winners: [],
    alliesPlayed: 0,
    seats: [s],
  };
  return {
    id: `g${id++}`,
    schema: SAVE_SCHEMA,
    config: CONFIG,
    createdAt: 1,
    updatedAt: id,
    status: won ? "won" : "lost",
    round: 5,
    commandCount: 1,
    outcome: won ? { result: "win", reason: "villainDefeated" } : { result: "loss", reason: "mainSchemeCompleted" },
    campaignId: null,
    campaignNodeId: null,
    summary,
    ...extra,
  };
};

describe("deckInsightsOf", () => {
  test("a hero and a deck each gather their games, cards in the deck, and cards that came out", () => {
    const insights = deckInsightsOf([game(true), game(false, seat({ plays: {}, entered: { aunt: 1 } }))], NAMES);
    const hero = insights.heroes.spidey!;
    expect(hero).toMatchObject({ games: 2, wins: 1, losses: 1, lostToScheme: 1, tracked: 2 });
    expect(hero.inDeck.webs).toBe(2);
    expect(hero.usedIn).toEqual({ webs: 1, aunt: 1 });
    expect(hero.wonWith).toEqual({ webs: 1 });
    expect(insights.decks["starter:spidey-justice"]!.games).toBe(2);
  });

  test("a guided game and a game in play do not count", () => {
    const insights = deckInsightsOf(
      [game(true, seat(), { guided: { kind: "tutorial" } as never }), game(true, seat(), { status: "active" })],
      NAMES,
    );
    expect(insights.heroes.spidey).toBeUndefined();
  });
});

describe("fromYourGamesOf", () => {
  const four = [
    game(true, seat({ deck: ["webs", "aunt", "bot", "first"], plays: { webs: 1, first: 1 } })),
    game(true, seat({ deck: ["webs", "aunt", "bot", "first"], plays: { webs: 1, first: 1 } })),
    game(true, seat({ deck: ["webs", "aunt", "bot", "tac"], plays: { webs: 1, tac: 1 } })),
    game(false, seat({ deck: ["webs", "aunt", "bot"], plays: { webs: 1 } })),
  ];
  const insights = deckInsightsOf(four, NAMES);

  test("cut: cards in this deck that rarely come out, never the hero's own; keep: the ones that nearly always do", () => {
    const view = fromYourGamesOf(insights, "spidey", ["webs", "aunt", "bot", "energy"], ["justice"], NAMES);
    expect(view.headline).toBe("Spider-Man · 4 games · 3–1");
    // Aunt May never came out either, but she is Spider-Man's own: a deck must include her (RRG 1.8 p. 50).
    expect(view.cut.map((c) => c.cardId)).toEqual(["bot"]);
    expect(view.cut[0]!.detail).toBe("Never played in 4 games");
    expect(view.keep.map((c) => c.cardId)).toEqual(["webs"]);
  });

  test("try: cards won with on this hero that this deck lacks and may take (not another aspect's)", () => {
    const view = fromYourGamesOf(insights, "spidey", ["webs", "aunt", "bot"], ["justice"], NAMES);
    expect(view.tryCards.map((c) => c.cardId)).toEqual(["first"]);
    expect(view.tryCards[0]!.detail).toBe("In 2 wins with Spider-Man");
  });

  test("the insight names how the losses came and the per-game numbers", () => {
    const view = fromYourGamesOf(insights, "spidey", [], ["justice"], NAMES);
    expect(view.insight).toBe(
      "1 of 1 loss came from the main scheme. You remove 4.0 threat and deal 10.0 damage a game.",
    );
  });

  test("no games with the hero: a note, no lists", () => {
    const view = fromYourGamesOf(deckInsightsOf([], NAMES), "spidey", ["webs"], ["justice"], NAMES);
    expect(view.headline).toBeNull();
    expect(view.note).toContain("Play Spider-Man");
  });
});

describe("deckPlayOf", () => {
  test("the record, how it lost, its staple and the card that sits idle", () => {
    const insights = deckInsightsOf([game(true), game(true), game(false)], NAMES);
    const play = deckPlayOf(insights, "starter:spidey-justice", "spidey", NAMES)!;
    expect(play.record).toBe("2–1");
    expect(play.losses).toBe("Lost 1 to the scheme");
    expect(play.staple).toEqual({ cardId: "webs", detail: "played in 3 of 3" });
    // Aunt May sits idle too, but the deck must keep her (RRG 1.8 p. 50); the support is the one to name.
    expect(play.idle?.cardId).toBe("bot");
  });

  test("a deck with no finished games has no box", () => {
    expect(deckPlayOf(deckInsightsOf([], NAMES), "starter:spidey-justice", "spidey", NAMES)).toBeNull();
  });
});
