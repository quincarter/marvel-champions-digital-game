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

describe("custom scenarios on the Matchups grids (issue #937)", () => {
  const SCENARIO = "the-rose-bf-the-rose";
  const SET = "the-rose-bf-goons";
  const roseSave = (authors?: readonly string[]): SaveMeta => {
    const base = save() as unknown as SaveMeta & { config: Record<string, unknown> };
    const pack = {
      ...PACK,
      ...(authors ? { authors } : {}),
      scenarios: [{ id: SCENARIO, name: "The Rose", recommendedModularSetIds: [SET] }],
      encounterSets: [{ id: SET, name: "Rose Goons" }],
    };
    return {
      ...base,
      config: { ...base.config, scenarioId: SCENARIO, modularSetIds: [SET], packs: [pack] },
    } as never;
  };
  const rowsOf = (stats: ReturnType<typeof playerStatsOf>) => stats.matchups!.heroes.rows.map((row) => row.name);

  test("names a pack's scenario and encounter set from the save, never by its id", () => {
    setLoadedPacks([]);
    const names = statsNamesForSaves([roseSave()]);
    expect(names.scenarioName(SCENARIO)).toBe("The Rose");
    expect(names.setName?.(SET)).toBe("Rose Goons");
    expect(names.scenarioModulars?.(SCENARIO)).toEqual([SET]);
    expect(rowsOf(playerStatsOf([roseSave()], names))).toContain("The Rose");
    expect(rowsOf(playerStatsOf([roseSave()], names))).not.toContain(SCENARIO);
  });

  test("tags custom rows and columns with the pack's designer", () => {
    setLoadedPacks([]);
    const saves = [roseSave(["PermaKarma"])];
    const stats = playerStatsOf(saves, statsNamesForSaves(saves));
    expect(rowsOf(stats)).toContain("The Rose (by PermaKarma)");
    expect(stats.matchups!.heroes.columns.map((column) => column.name)).toContain("Sample (by PermaKarma)");
    expect(stats.matchups!.modulars.columns.map((column) => column.name)).toContain("Rose Goons (by PermaKarma)");
    // An official scenario keeps its plain name.
    expect(rowsOf(stats)).toContain("Rhino");
  });

  test("a newer save of a pack stored without authors keeps the designer an older save named", () => {
    setLoadedPacks([]);
    const older = { ...roseSave(["Creator"]), id: "old", updatedAt: 1, createdAt: 1 } as SaveMeta;
    const newer = { ...roseSave(), id: "new", updatedAt: 9, createdAt: 9 } as SaveMeta;
    for (const saves of [
      [older, newer],
      [newer, older],
    ]) {
      expect(rowsOf(playerStatsOf(saves, statsNamesForSaves(saves)))).toContain("The Rose (by Creator)");
    }
  });

  test("a game with no modulars named takes its scenario's defaults from its own version of the pack", () => {
    setLoadedPacks([]);
    const versioned = (id: string, at: number, set: string): SaveMeta => {
      const base = roseSave() as unknown as { config: { packs: Record<string, unknown>[] } & Record<string, unknown> };
      const pack = {
        ...base.config.packs[0]!,
        scenarios: [{ id: SCENARIO, name: "The Rose", recommendedModularSetIds: [set] }],
      };
      const { modularSetIds: _none, ...config } = base.config;
      return { ...base, id, updatedAt: at, createdAt: at, config: { ...config, packs: [pack] } } as never;
    };
    const saves = [versioned("old", 1, "old-goons"), versioned("new", 9, "new-goons")];
    const columns = playerStatsOf(saves, statsNamesForSaves(saves)).matchups!.modulars.columns.map((c) => c.id);
    expect(columns).toEqual(expect.arrayContaining(["old-goons", "new-goons"]));
  });

  test("a pack saved before its authors were kept takes them from the installed pack", () => {
    setLoadedPacks([]);
    const saves = [roseSave()];
    const stats = playerStatsOf(saves, statsNamesForSaves(saves, undefined, { sample: ["PermaKarma", "Bob"] }));
    expect(rowsOf(stats)).toContain("The Rose (by PermaKarma & Bob)");
  });
});

describe("two versions of one pack", () => {
  const versioned = (id: string, at: number, aspect: string, name: string): SaveMeta => {
    const base = save() as unknown as SaveMeta & { config: { packs: unknown[] } };
    const pack = {
      ...PACK,
      cards: PACK.cards.map((c) => (c.id === HERO ? { ...c, name } : c)),
      decks: [{ ...PACK.decks[0]!, aspects: [aspect], name: `${name} deck` }],
    };
    // No summary: the seat comes from the precon id, so it reads the save's own version of the pack.
    return {
      ...base,
      id,
      updatedAt: at,
      createdAt: at,
      summary: null,
      config: { ...base.config, packs: [pack] as never },
    };
  };
  const older = versioned("old", 10, "justice", "Old Sample");
  const newer = versioned("new", 20, "aggression", "New Sample");

  test("each game's seat facts come from its own version of the pack", () => {
    setLoadedPacks([]);
    const names = statsNamesForSaves([older, newer]);
    expect(names.forSave?.(older).starterDeck(DECK)?.aspects).toEqual(["justice"]);
    expect(names.forSave?.(newer).starterDeck(DECK)?.aspects).toEqual(["aggression"]);
    const stats = playerStatsOf([older, newer], names);
    expect(stats.aspects.map((a) => a.aspect).sort()).toEqual(expect.arrayContaining(["justice", "aggression"]));
  });

  test("the aggregate display names do not depend on the order the saves arrive in", () => {
    setLoadedPacks([]);
    const forward = [older, newer];
    const backward = [newer, older];
    expect(playerStatsOf(forward, statsNamesForSaves(forward))).toEqual(
      playerStatsOf(backward, statsNamesForSaves(backward)),
    );
    for (const saves of [forward, backward]) {
      const names = statsNamesForSaves(saves);
      expect(names.cardName(HERO)).toBe("New Sample");
      expect(names.starterDeckName?.(DECK)).toBe("New Sample deck");
    }
  });
});
