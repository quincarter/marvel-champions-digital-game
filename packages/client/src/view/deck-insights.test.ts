import { describe, expect, test } from "vitest";
import type { SessionConfig } from "../engine/host.js";
import { SAVE_SCHEMA, type SaveMeta } from "../engine/game-storage.js";
import type { GameSummary, SeatSummary } from "../engine/game-summary.js";
import type { StatsNames } from "./player-stats-model.js";
import {
  againstStepOf,
  againstVillainOf,
  cardPlayOf,
  deckInsightsOf,
  fromYourGamesOf,
  villainsFacedOf,
} from "./deck-insights.js";

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

describe("against a villain", () => {
  const against = (villain: string, won: boolean, deck: readonly string[]): SaveMeta => {
    const base = game(won, seat({ deck }));
    return { ...base, summary: { ...base.summary!, villains: [villain] } };
  };
  const saves = [
    against("Klaw", true, ["webs", "first", "bot"]),
    against("Klaw", true, ["webs", "first"]),
    against("Klaw", false, ["webs", "bot"]),
    against("Rhino", true, ["webs"]),
  ];
  const insights = deckInsightsOf(saves, NAMES);

  test("each villain gathers the decks that won and lost to it", () => {
    expect(insights.villains.Klaw).toEqual({
      wins: 2,
      losses: 1,
      inWins: { webs: 2, first: 2, bot: 1 },
      inLosses: { webs: 1, bot: 1 },
    });
  });

  test("a game without card numbers is not counted", () => {
    const { summary: _none, ...bare } = against("Klaw", true, ["webs"]);
    expect(deckInsightsOf([bare as SaveMeta], NAMES).villains).toEqual({});
  });

  test("villains faced, most first", () => {
    expect(villainsFacedOf(insights)).toEqual(["Klaw", "Rhino"]);
  });

  test("the stepper: Your decks walks faced villains; Everyone adds the rest of the pool, sorted by name", () => {
    const pool = ["Zzax", "Rhino", "Absorbing Man", "Klaw", "Rhino"];
    expect(againstStepOf(insights, pool, "yours")).toEqual(["Klaw", "Rhino"]);
    expect(againstStepOf(insights, pool, "everyone")).toEqual(["Klaw", "Rhino", "Absorbing Man", "Zzax"]);
    // No games at all: Your decks has nothing to walk, Everyone starts on the first villain by name.
    const none = deckInsightsOf([], NAMES);
    expect(againstStepOf(none, pool, "yours")).toEqual([]);
    expect(againstStepOf(none, pool, "everyone")).toEqual(["Absorbing Man", "Klaw", "Rhino", "Zzax"]);
  });

  test("try: cards leaning to your wins that this deck lacks and may take; cut: those leaning to your losses", () => {
    const view = againstVillainOf(insights, "Klaw", "spidey", ["webs", "bot"], ["justice"], NAMES)!;
    expect(view.headline).toBe("Against Klaw · 2 wins, 1 loss");
    expect(view.tryCards).toEqual([{ cardId: "first", detail: "In 2 of 2 wins · 0 of 1 loss" }]);
    expect(view.cutCards).toEqual([{ cardId: "bot", detail: "In 1 of 2 wins · 1 of 1 loss" }]);
    expect(view.note).toBeNull();
  });

  test("a card another aspect's deck won with is not offered", () => {
    const other = deckInsightsOf([against("Klaw", true, ["tac"]), against("Klaw", false, [])], NAMES);
    expect(againstVillainOf(other, "Klaw", "spidey", [], ["justice"], NAMES)!.tryCards).toEqual([]);
    const own = againstVillainOf(other, "Klaw", "spidey", [], ["aggression"], NAMES)!;
    expect(own.tryCards.map((c) => c.cardId)).toEqual(["tac"]);
  });

  test("the hero's own card is never offered to cut", () => {
    const lost = deckInsightsOf([against("Klaw", true, []), against("Klaw", false, ["aunt"])], NAMES);
    const view = againstVillainOf(lost, "Klaw", "spidey", ["aunt"], ["justice"], NAMES)!;
    expect(view.cutCards).toEqual([]);
  });

  test("one deck is too little to say anything; a villain never faced is null", () => {
    const view = againstVillainOf(insights, "Rhino", "spidey", [], ["justice"], NAMES)!;
    expect(view.tryCards).toEqual([]);
    expect(view.note).toContain("few more times");
    expect(againstVillainOf(insights, "Ultron", "spidey", [], ["justice"], NAMES)).toBeNull();
  });
});

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

describe("cardPlayOf", () => {
  const insights = deckInsightsOf(
    [
      game(true, seat({ plays: { webs: 2 }, activations: { webs: 3 } })),
      game(false, seat({ plays: {}, activations: {} })),
    ],
    NAMES,
  );

  test("a card's games, plays, abilities used and win rate when it came out", () => {
    expect(cardPlayOf(insights, "webs", null, NAMES)).toEqual([
      { label: "In your deck", value: "2 games" },
      { label: "Came out", value: "1 of 2 games" },
      { label: "Played", value: "2×" },
      { label: "Abilities used", value: "3×" },
      { label: "Won when it came out", value: "100% (1 of 1)" },
      { label: "Played with", value: "Spider-Man" },
    ]);
  });

  test("for one hero, without the Played with line; nothing for a card never in a deck", () => {
    expect(cardPlayOf(insights, "webs", "spidey", NAMES)?.map((l) => l.label)).not.toContain("Played with");
    expect(cardPlayOf(insights, "tac", null, NAMES)).toBeNull();
    expect(cardPlayOf(insights, "webs", "cap", NAMES)).toBeNull();
  });
});
