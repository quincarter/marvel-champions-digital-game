/**
 * Wave 7 (cycle 7, NeXt Evolution) in the playable pool (docs/wave-definition-of-done.md step 5, cards half): its
 * heroes, scenarios and modular sets are chosen through `playableScenario` like every earlier wave's, the Dreadpool set
 * follows the 'Pool aspect into every scenario of every wave, and the campaign cards stay campaign-only.
 */
import {
  CORE_STARTER_DECKS,
  PLAYABLE_CARDS,
  WAVE7_ENCOUNTER_SETS,
  WAVE7_SCENARIOS,
  WAVE7_STARTER_DECKS,
  type DeckContents,
} from "@mc/content";
import { cardsInPlay, createGame, validateDeck } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { firstLegal, settle } from "../testing/harness.js";
import { MODULAR_SETS } from "../testing/modular-matrix.js";
import { PLAYABLE_ABILITIES, PLAYABLE_DEPS, playableScenario, playableStarterDeckSetup } from "./index.js";

const NEW_HEROES = [
  "cable-leadership",
  "domino-justice",
  "psylocke-justice",
  "angel-protection",
  "x-23-aggression",
  "deadpool-pool",
];
const NEW_SCENARIOS = ["morlock-siege", "on-the-run", "juggernaut", "mister-sinister", "stryfe"];
const NEW_MODULAR_SETS = [
  "black_tom_cassidy",
  "extreme_measures",
  "flight",
  "military_grade",
  "mutant_insurrection",
  "mutant_slayers",
  "nasty_boys",
  "super_strength",
  "telepathy",
];

const codeOf = (state: { instances: Record<string, { cardId: unknown }> }, id: string) =>
  state.instances[id]!.cardId as string;

describe("wave 7 in the playable pool", () => {
  it("the six precons are playable starter decks and the five scenarios are in the pool", () => {
    expect(WAVE7_STARTER_DECKS.map((d) => d.id as string)).toEqual(NEW_HEROES);
    for (const id of NEW_HEROES) expect(playableStarterDeckSetup(id).deck.length).toBeGreaterThan(0);
    expect(WAVE7_SCENARIOS.map((s) => s.id as string)).toEqual(NEW_SCENARIOS);
  });

  it("every wave 7 ability is in the playable registry", () => {
    expect(PLAYABLE_ABILITIES["44046.break-time-action"]).toBeDefined();
    expect(PLAYABLE_ABILITIES["40130.hope-summers-constant"]).toBeDefined();
  });

  it.each(NEW_SCENARIOS)("%s builds and starts a game through playableScenario, every hero seated", (scenarioId) => {
    const config = playableScenario(scenarioId, {
      seed: 3,
      players: NEW_HEROES.slice(0, 4).map((starterDeckId) => ({ starterDeckId })),
    });
    const created = createGame(config, PLAYABLE_DEPS);
    expect(created.ok).toBe(true);
  });

  it('a wave 7 scenario refuses "extreme" (Breakout\'s own challenge)', () => {
    expect(() =>
      playableScenario("juggernaut", {
        seed: 1,
        difficulty: "extreme",
        players: [{ starterDeckId: "cable-leadership" }],
      }),
    ).toThrow("cycle 7");
  });

  it("the nine modular sets are the playable pool's modular choices from this wave: Hope Summers and Dreadpool are not", () => {
    const fromWave7 = MODULAR_SETS.filter((set) => WAVE7_ENCOUNTER_SETS.some((s) => s.id === set.id)).map(
      (set) => set.id as string,
    );
    expect(fromWave7.sort()).toEqual([...NEW_MODULAR_SETS].sort());
  });

  it.each(NEW_MODULAR_SETS)("%s can be the modular set of a Core scenario", (setId) => {
    const config = playableScenario("rhino", {
      seed: 2,
      players: [{ starterDeckId: "core-spider-man-justice" }],
      modularSetIds: [setId],
    });
    const created = createGame(config, PLAYABLE_DEPS);
    expect(created.ok).toBe(true);
  });

  it.each(["hope_summers", "dreadpool", "next_evol_campaign", "marauders", "cable_nemesis"])(
    "%s is not a modular choice at a Core scenario",
    (setId) => {
      expect(() =>
        playableScenario("rhino", {
          seed: 2,
          players: [{ starterDeckId: "core-spider-man-justice" }],
          modularSetIds: [setId],
        }),
      ).toThrow();
    },
  );
});

describe("the Dreadpool set follows the 'Pool aspect into every scenario of every wave", () => {
  const dreadpoolIn = (scenarioId: string, decks: readonly string[]): string[] => {
    const config = playableScenario(scenarioId, {
      seed: 5,
      players: decks.map((starterDeckId) => ({ starterDeckId })),
    });
    const created = createGame(config, PLAYABLE_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    return Object.keys(created.state.instances)
      .map((id) => codeOf(created.state, id))
      .filter((code) => code >= "44037" && code <= "44042");
  };

  it.each(["rhino", "klaw", "ultron", "sabretooth"])(
    "a 'Pool deck at %s brings all seven Dreadpool cards",
    (scenarioId) => {
      expect(dreadpoolIn(scenarioId, ["deadpool-pool"])).toHaveLength(7);
    },
  );

  it("a Core hero's deck without the 'Pool aspect never gets the set", () => {
    expect(dreadpoolIn("rhino", ["core-spider-man-justice"])).toEqual([]);
  });

  it("a wave 7 scenario brings the set once", () => {
    expect(dreadpoolIn("stryfe", ["deadpool-pool", "cable-leadership"])).toHaveLength(7);
  });
});

describe("the NeXt Evolution campaign cards stay campaign-only against the whole playable pool", () => {
  const domino = WAVE7_STARTER_DECKS.find((d) => d.id === "domino-justice")!;
  const contents = (extra: string): DeckContents => ({
    identityCardId: domino.identityCardId,
    aspects: domino.aspects,
    cards: [...domino.cards, { cardId: extra as never, quantity: 1 }],
  });
  const campaignIds = ["40190a", "40191a", "40192a", "40193a", "40194a", "40195a", "40196", "40197"];

  it.each(campaignIds)("%s is refused in a standalone deck", (id) => {
    const verdict = validateDeck(contents(id), PLAYABLE_CARDS);
    expect(verdict.ok ? [] : verdict.problems.map((p) => p.code)).toEqual(["campaign_card"]);
  });

  it("every card of the campaign set is campaign-specific, so none is choosable", () => {
    const campaignCards = PLAYABLE_CARDS.filter(
      (card) => "specificTo" in card && card.specificTo?.kind === "campaign" && card.setCode === "next_evol",
    );
    expect(campaignCards.length).toBeGreaterThan(0);
    for (const card of campaignCards) {
      const verdict = validateDeck(contents(card.id), PLAYABLE_CARDS);
      if (card.type === "hero_identity") continue;
      expect(verdict.ok, card.id).toBe(false);
    }
  });

  it("the Core starter decks are untouched by the new pool", () => {
    for (const deck of CORE_STARTER_DECKS)
      expect(
        validateDeck({ identityCardId: deck.identityCardId, aspects: deck.aspects, cards: deck.cards }, PLAYABLE_CARDS),
      ).toEqual({ ok: true });
  });
});

describe("On the Run and the setup keyword (RRG 1.8 Appendix II step 11, p. 51)", () => {
  // A card with the setup keyword begins the game in play. On the Run's villains start set aside
  // (`villainsStartSetAside`), so Flight (40151, "Attach to the villain") has no villain at step 11: it waits, set aside,
  // and attaches when Gotta Get Away 1A puts the villain into play. Morlock Siege's villain is in play at step 11.
  const flightOnTheVillain = (scenarioId: string): boolean => {
    const config = playableScenario(scenarioId, {
      seed: 1,
      players: [{ starterDeckId: "core-spider-man-justice" }],
      modularSetIds: ["flight", "military_grade"],
    });
    const created = createGame(config, PLAYABLE_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const state = settle(created.state, firstLegal, (s) => s.step.phase !== "setup", PLAYABLE_DEPS);
    const flight = cardsInPlay(state).find((id) => state.instances[id]!.cardId === "40151");
    const villains = state.villains.filter((villain) => !villain.defeated).map((villain) => villain.instanceId);
    return flight !== undefined && villains.includes(state.instances[flight]!.attachedTo!);
  };

  it("Morlock Siege: Flight begins in play", () => {
    expect(flightOnTheVillain("morlock-siege")).toBe(true);
  });

  it("On the Run: Flight begins in play", () => {
    expect(flightOnTheVillain("on-the-run")).toBe(true);
  });
});
