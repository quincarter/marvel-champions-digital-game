import { describe, expect, test } from "vitest";
import type { GlobalStats, GlobalVillainCards } from "@mc/sync-worker/global-protocol";
import { againstVillainOf } from "../view/deck-insights.js";
import { LOSS_LABELS } from "../view/player-stats-model.js";
import { globalSectionsOf, globalVillainDecksOf } from "./global-stats-model.js";
import { NAMES } from "./fixtures.js";

const STATS: GlobalStats = {
  updatedAt: 1,
  games: 100,
  heroes: [
    { key: "cap", games: 25, wins: 10, causes: { scheme: 5, villain: 10 } },
    { key: "spidey", games: 60, wins: 45, causes: { minions: 15 } },
    { key: "mystery", games: 90, wins: 1, causes: {} },
  ],
  villains: [
    { key: "Rhino", games: 30, wins: 15, causes: { scheme: 10, unknown: 5 } },
    { key: "Klaw", games: 50, wins: 25, causes: {} },
  ],
  modulars: [
    { key: "ambush", games: 21, wins: 7, causes: { encounter: 14 } },
    { key: "nope", games: 99, wins: 9, causes: {} },
  ],
};

const labels = (rows: readonly { kind: string; label?: string }[]): (string | undefined)[] => rows.map((r) => r.label);

describe("globalSectionsOf", () => {
  const sections = globalSectionsOf(STATS, NAMES);

  test("the same sections as Your stats, with global ids", () => {
    expect(sections.map((s) => s.id)).toEqual(["global:heroes", "global:villains", "global:encounter"]);
  });

  test("most played first, names through the pool, unknown ids dropped", () => {
    expect(labels(sections[0]!.rows)).toEqual(["Spider-Man", "Captain America"]);
    expect(sections[0]!.count).toBe("2 heroes");
    expect(labels(sections[1]!.rows)).toEqual(["Klaw", "Rhino"]);
    expect(labels(sections[2]!.rows)).toEqual(["Ambush"]);
  });

  test("a row has the win rate, the games and its losses from the model's labels", () => {
    const cap = sections[0]!.rows[1]!;
    expect(cap).toMatchObject({
      kind: "stat",
      id: "global:hero:cap",
      value: "40%",
      detail: "25 games",
      losses: [
        { cause: "scheme", label: LOSS_LABELS.scheme, count: 5 },
        { cause: "villain", label: LOSS_LABELS.villain, count: 10 },
      ],
    });
    expect(sections[1]!.rows[0]).not.toHaveProperty("losses");
  });

  test("hero rows carry the hero's card for the picture and hover; villain and set rows do not", () => {
    expect(sections[0]!.rows.map((r) => (r.kind === "stat" ? r.cardId : null))).toEqual(["spidey", "cap"]);
    expect(sections[1]!.rows[0]).not.toHaveProperty("cardId");
    expect(sections[2]!.rows[0]).not.toHaveProperty("cardId");
  });

  test("only villains this build knows, each part of a join; none without a lookup", () => {
    const villains = (names: typeof NAMES, rows: string[]) =>
      globalSectionsOf(
        { ...STATS, heroes: [], modulars: [], villains: rows.map((key) => ({ key, games: 30, wins: 1, causes: {} })) },
        names,
      ).flatMap((s) => labels(s.rows));
    expect(villains(NAMES, ["Rhino", "Rhino & Klaw", "Forged", "Rhino & Forged"])).toEqual(["Rhino", "Rhino & Klaw"]);
    const { isVillain: _drop, ...without } = NAMES;
    expect(villains(without, ["Rhino"])).toEqual([]);
  });

  test("a section with nothing nameable is left out", () => {
    expect(globalSectionsOf({ ...STATS, heroes: [], modulars: [] }, NAMES).map((s) => s.id)).toEqual([
      "global:villains",
    ]);
  });
});

describe("globalVillainDecksOf", () => {
  const cards: GlobalVillainCards = {
    villain: "Rhino",
    wins: 12,
    losses: 8,
    inWins: { tac: 10 },
    inLosses: { tac: 1 },
  };

  test("reads like your own villain decks, so againstVillainOf takes either", () => {
    const decks = globalVillainDecksOf(cards);
    expect(decks).toEqual({ wins: 12, losses: 8, inWins: { tac: 10 }, inLosses: { tac: 1 } });
    const names = { ...NAMES, cardName: () => "Tackle", cardType: () => "event", cardAspect: () => "aggression" };
    const insights = { heroes: {}, decks: {}, villains: { Rhino: decks } };
    const against = againstVillainOf(insights, "Rhino", "spidey", [], ["aggression"], names);
    expect(against?.tryCards.map((c) => c.cardId)).toEqual(["tac"]);
  });
});
