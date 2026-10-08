/**
 * Wave 8 (cycle 8, Age of Apocalypse) in the playable pool (docs/wave-definition-of-done.md step 5, cards half): its
 * heroes, scenarios and modular sets are chosen through `playableScenario` like every earlier wave's, a modular set of
 * any box sits at a wave 8 scenario, and the campaign cards stay campaign-only.
 */
import {
  CORE_STARTER_DECKS,
  PLAYABLE_CARDS,
  WAVE8_ENCOUNTER_SETS,
  WAVE8_SCENARIOS,
  WAVE8_STARTER_DECKS,
  type DeckContents,
} from "@mc/content";
import { createGame, validateDeck } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { CAMPAIGNS } from "../campaigns/index.js";
import { MODULAR_SETS } from "../testing/modular-matrix.js";
import { WAVE8_ABILITIES } from "../wave8/index.js";
import { PLAYABLE_ABILITIES, PLAYABLE_DEPS, playableScenario, playableStarterDeckSetup } from "./index.js";

const NEW_HEROES = [
  "bishop-leadership",
  "magik-aggression",
  "iceman-aggression",
  "jubilee-justice",
  "nightcrawler-protection",
  "magneto-leadership",
];
const NEW_SCENARIOS = ["unus", "four-horsemen", "apocalypse", "dark-beast", "en-sabah-nur"];
const NEW_MODULAR_SETS = [
  "arcade",
  "blue_moon",
  "celestial_tech",
  "clan_akkaba",
  "crazy_gang",
  "dark_riders",
  "dystopian_nightmare",
  "genosha",
  "hellfire",
  "hounds",
  "infinites",
  "sauron",
  "savage_land",
];
/** The box's campaign-only encounter sets (MC45 pp. 5, 18 to 23). `aoa_basic_campaign` holds no encounter card. */
const CAMPAIGN_SETS = ["age_of_apocalypse", "aoa_basic_campaign", "aoa_campaign", "aoa_mission", "overseer"];

const cardsOfSets = (setIds: readonly string[]): Set<string> =>
  new Set(
    PLAYABLE_CARDS.filter(
      (card) =>
        "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).some((id) => setIds.includes(id)),
    ).map((card) => card.id as string),
  );

const everyCardOf = (config: ReturnType<typeof playableScenario>): string[] => {
  const created = createGame(config, PLAYABLE_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return Object.values(created.state.instances).map((instance) => instance.cardId as string);
};

describe("wave 8 in the playable pool", () => {
  it("the six precons are playable starter decks and the five scenarios are in the pool", () => {
    expect(WAVE8_STARTER_DECKS.map((d) => d.id as string)).toEqual(NEW_HEROES);
    for (const id of NEW_HEROES) expect(playableStarterDeckSetup(id).deck.length).toBeGreaterThan(0);
    expect(WAVE8_SCENARIOS.map((s) => s.id as string)).toEqual(NEW_SCENARIOS);
  });

  it("every wave 8 ability is in the playable registry", () => {
    expect(PLAYABLE_ABILITIES["45062a.setup"]).toBeDefined();
    expect(PLAYABLE_ABILITIES["46002.frostbite-constant"]).toBeDefined();
    for (const [id, ability] of Object.entries(WAVE8_ABILITIES)) expect(PLAYABLE_ABILITIES[id], id).toBe(ability);
  });

  it.each(NEW_SCENARIOS)("%s builds and starts a game through playableScenario, every hero seated", (scenarioId) => {
    for (const seats of [NEW_HEROES.slice(0, 4), NEW_HEROES.slice(2)]) {
      const config = playableScenario(scenarioId, {
        seed: 3,
        players: seats.map((starterDeckId) => ({ starterDeckId })),
      });
      expect(config.cards).toBe(PLAYABLE_CARDS);
      const created = createGame(config, PLAYABLE_DEPS);
      expect(created.ok).toBe(true);
    }
  });

  it.each(NEW_SCENARIOS)("%s seats a Core precon and an earlier wave's", (scenarioId) => {
    const config = playableScenario(scenarioId, {
      seed: 4,
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "cable-leadership" }],
    });
    expect(createGame(config, PLAYABLE_DEPS).ok).toBe(true);
  });

  it('a wave 8 scenario refuses "extreme" (Breakout\'s own challenge)', () => {
    expect(() =>
      playableScenario("four-horsemen", {
        seed: 1,
        difficulty: "extreme",
        players: [{ starterDeckId: "bishop-leadership" }],
      }),
    ).toThrow("cycle 8");
  });

  it("the thirteen modular sets are the playable pool's modular choices from this wave", () => {
    const fromWave8 = MODULAR_SETS.filter((set) => WAVE8_ENCOUNTER_SETS.some((s) => s.id === set.id)).map(
      (set) => set.id as string,
    );
    expect(fromWave8.sort()).toEqual([...NEW_MODULAR_SETS].sort());
  });

  it.each(NEW_MODULAR_SETS)("%s can be the modular set of a Core scenario, and its cards are in the game", (setId) => {
    const config = playableScenario("rhino", {
      seed: 2,
      players: [{ starterDeckId: "core-spider-man-justice" }],
      modularSetIds: [setId],
    });
    const inGame = new Set(everyCardOf(config));
    const ofSet = [...cardsOfSets([setId])];
    expect(ofSet.length).toBeGreaterThan(0);
    expect(ofSet.some((id) => inGame.has(id))).toBe(true);
  });

  it.each([
    ...CAMPAIGN_SETS,
    "prelates",
    "standard_iii",
    "unus",
    "four_horsemen",
    "apocalypse",
    "dark_beast",
    "en_sabah_nur",
    "bishop_nemesis",
    "magneto_nemesis",
  ])("%s is not a modular choice at a Core scenario", (setId) => {
    expect(() =>
      playableScenario("rhino", {
        seed: 2,
        players: [{ starterDeckId: "core-spider-man-justice" }],
        modularSetIds: [setId],
      }),
    ).toThrow();
  });

  it.each([
    ["unus", ["bomb_scare"]],
    ["unus", ["reavers"]],
    ["four-horsemen", ["military_grade", "legions_of_hydra"]],
    ["en-sabah-nur", ["sauron", "black_tom_cassidy"]],
  ] as const)("%s takes an earlier box's modular set %j", (scenarioId, modularSetIds) => {
    const config = playableScenario(scenarioId, {
      seed: 6,
      players: [{ starterDeckId: "bishop-leadership" }],
      modularSetIds,
    });
    const inGame = new Set(everyCardOf(config));
    for (const setId of modularSetIds) {
      const ofSet = [...cardsOfSets([setId])];
      expect(ofSet.length, setId).toBeGreaterThan(0);
      expect(
        ofSet.some((id) => inGame.has(id)),
        setId,
      ).toBe(true);
    }
  });

  it("Longshot, an extra modular set, joins a wave 8 scenario once", () => {
    const players = [{ starterDeckId: "magik-aggression" }];
    const plain = playableScenario("unus", { players, seed: 7 });
    const withLongshot = playableScenario("unus", { players, seed: 7, extraModularSetIds: ["longshot"] });
    expect(withLongshot.encounterDeck).toHaveLength((plain.encounterDeck ?? []).length + 1);
    expect(createGame(withLongshot, PLAYABLE_DEPS).ok).toBe(true);
  });
});

describe("the Jubilee and Wolverine Team-Up (Unlikely Duo 47022) is card data, as every pair is", () => {
  const unlikelyDuo = PLAYABLE_CARDS.find((card) => card.id === "47022")!;
  const deckWith = (starterDeckId: string): DeckContents => {
    const deck = [...WAVE8_STARTER_DECKS, ...CORE_STARTER_DECKS].find((d) => d.id === starterDeckId)!;
    return {
      identityCardId: deck.identityCardId,
      aspects: deck.aspects,
      cards: [...deck.cards.filter((entry) => entry.cardId !== "47022"), { cardId: "47022" as never, quantity: 1 }],
    };
  };

  it("names the pair and is scripted", () => {
    expect("keywords" in unlikelyDuo ? unlikelyDuo.keywords : []).toContainEqual({
      name: "teamUp",
      names: ["Jubilee", "Wolverine"],
    });
    expect(PLAYABLE_ABILITIES["47022.unlikely-duo-action"]).toBeDefined();
  });

  it("is legal in Jubilee's deck and refused in another hero's (RRG 1.8 Team-Up, p. 43)", () => {
    expect(validateDeck(deckWith("jubilee-justice"), PLAYABLE_CARDS)).toEqual({ ok: true });
    const verdict = validateDeck(deckWith("core-spider-man-justice"), PLAYABLE_CARDS);
    expect(verdict.ok ? [] : verdict.problems.map((p) => p.code)).toContain("team_up_identity");
  });
});

describe("the Age of Apocalypse campaign cards stay campaign-only against the whole playable pool", () => {
  const bishop = WAVE8_STARTER_DECKS.find((d) => d.id === "bishop-leadership")!;
  const contents = (extra: string): DeckContents => ({
    identityCardId: bishop.identityCardId,
    aspects: bishop.aspects,
    cards: [...bishop.cards, { cardId: extra as never, quantity: 1 }],
  });
  /** Mission Team, Destiny, Blink, Morph, X-Man and Desperate Measures (MC45 pp. 5, 23). */
  const campaignIds = ["45171a", "45172", "45173", "45174", "45175", "45176"];

  it("these are the box's player-side campaign cards", () => {
    const found = PLAYABLE_CARDS.filter(
      (card) => "specificTo" in card && card.specificTo?.kind === "campaign" && card.setCode === "aoa",
    ).map((card) => card.id as string);
    expect(found.sort()).toEqual(campaignIds);
  });

  it.each(campaignIds)("%s is refused in a standalone deck", (id) => {
    const verdict = validateDeck(contents(id), PLAYABLE_CARDS);
    expect(verdict.ok ? [] : verdict.problems.map((p) => p.code)).toEqual(["campaign_card"]);
  });

  it("no campaign set is among the modular choices", () => {
    const modular = new Set(MODULAR_SETS.map((set) => set.id as string));
    for (const id of CAMPAIGN_SETS) expect(modular.has(id), id).toBe(false);
    expect(WAVE8_ENCOUNTER_SETS.filter((set) => set.campaignSpecific).map((set) => set.id as string)).toEqual(
      CAMPAIGN_SETS,
    );
  });

  it.each(NEW_SCENARIOS)("%s: a standalone game holds no card of a campaign set and no campaign card", (scenarioId) => {
    const campaignCards = new Set([...cardsOfSets(CAMPAIGN_SETS), ...campaignIds]);
    for (const difficulty of ["standard", "expert"] as const) {
      const inGame = everyCardOf(
        playableScenario(scenarioId, {
          seed: 8,
          difficulty,
          players: NEW_HEROES.slice(0, 2).map((starterDeckId) => ({ starterDeckId })),
        }),
      );
      expect(inGame.filter((id) => campaignCards.has(id))).toEqual([]);
    }
  });

  it("the campaign definition is not registered: the client's Saga shelf does not list the box yet", () => {
    expect((CAMPAIGNS as Record<string, unknown>).aoa).toBeUndefined();
  });

  it("the Core starter decks are untouched by the new pool", () => {
    for (const deck of CORE_STARTER_DECKS)
      expect(
        validateDeck({ identityCardId: deck.identityCardId, aspects: deck.aspects, cards: deck.cards }, PLAYABLE_CARDS),
      ).toEqual({ ok: true });
  });
});
