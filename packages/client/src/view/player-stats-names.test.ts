import { describe, expect, test } from "vitest";
import { SAVE_SCHEMA, type SaveMeta } from "../engine/game-storage.js";
import type { GameSummary } from "../engine/game-summary.js";
import { setLoadedPacks } from "../packs/pack-registry.js";
import { playerStatsOf } from "./player-stats-model.js";
import { statsNamesForSaves } from "./player-stats-names.js";

const HERO = "x.sample.hero";
const SIG = "x.sample.sig";
const DECK = "x.sample.deck";

/** A custom pack as a save carries it: just the records the names read. */
const PACK = {
  id: "sample",
  cards: [
    {
      id: HERO,
      type: "hero_identity",
      name: "Sample",
      hero: { faceName: "Sample Sentinel" },
      alterEgo: { faceName: "Sam" },
    },
    { id: SIG, type: "upgrade", name: "Sentinel Shield", aspect: `hero:${HERO}` },
  ],
  decks: [{ id: DECK, name: "Sentinel (Justice)", identityCardId: HERO, aspects: ["justice"] }],
};

const save = (): SaveMeta =>
  ({
    id: "g1",
    schema: SAVE_SCHEMA,
    config: { scenarioId: "rhino", difficulty: "standard", players: [{ starterDeckId: DECK }], seed: 1, packs: [PACK] },
    createdAt: 1,
    updatedAt: 2,
    status: "won",
    round: 4,
    commandCount: 20,
    outcome: { result: "win", reason: "villainDefeated" },
    campaignId: null,
    campaignNodeId: null,
    summary: {
      lossReason: null,
      heroesDefeated: 0,
      winners: [],
      alliesPlayed: 0,
      villains: ["Rhino"],
      sideSchemes: { seen: {}, defeated: {} },
      seats: [
        {
          identityCardId: HERO,
          aspects: ["justice"],
          deck: [SIG],
          plays: { [SIG]: 2 },
          activations: {},
          entered: {},
          damage: 3,
          thwart: 1,
          defeated: false,
        },
      ],
    } satisfies GameSummary,
  }) as never;

describe("statsNamesForSaves", () => {
  test("names a custom precon, hero and cards from the saved packs with nothing loaded", () => {
    setLoadedPacks([]);
    const names = statsNamesForSaves([save()]);
    expect(names.starterDeckName?.(DECK)).toBe("Sentinel (Justice)");
    expect(names.starterDeck(DECK)).toEqual({ identityCardId: HERO, aspects: ["justice"] });
    expect(names.cardName(HERO)).toBe("Sample");
    expect(names.cardName(SIG)).toBe("Sentinel Shield");
    expect(names.cardType(SIG)).toBe("upgrade");
    expect(names.cardAspect(SIG)).toBe(`hero:${HERO}`);
  });

  test("the Decks tab lists the custom precon by name, with its cards named and flagged as signature", () => {
    setLoadedPacks([]);
    const saves = [save()];
    const stats = playerStatsOf(saves, statsNamesForSaves(saves));
    const deck = stats.decks.find((d) => d.id === `starter:${DECK}`)!;
    expect(deck.name).toBe("Sentinel (Justice)");
    expect(deck.identityCardId).toBe(HERO);
    // "Hide hero cards" leaves these out: the custom hero's card is marked signature.
    expect(deck.cards).toMatchObject([{ cardId: SIG, signature: true }]);
    expect(statsNamesForSaves(saves).cardName(deck.identityCardId)).toBe("Sample");
  });

  test("falls back to the base names for a save with no packs", () => {
    const plain = { config: { scenarioId: "rhino", difficulty: "standard", players: [], seed: 1 } } as never;
    const names = statsNamesForSaves([plain]);
    expect(names.cardName(HERO)).toBeUndefined();
  });
});
