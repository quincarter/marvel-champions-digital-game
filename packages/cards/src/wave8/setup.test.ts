import { WAVE8_CARDS, WAVE8_SCENARIOS } from "@mc/content";
import {
  createGame,
  maxHitPoints,
  villainOf,
  villainStageOf,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { firstLegal, inst, settle } from "../testing/harness.js";
import { WAVE8_DEPS } from "./index.js";
import { wave8Scenario } from "./setup.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The wave 8 scenario builder (`wave8Scenario`) for the five Age of Apocalypse scenarios, standard and expert, one and
 * two players. The numbers come from the card data (docs/phase7-wave8.md section 2): stage and hit points per player,
 * the main scheme's starting threat per player, and the encounter sets' card counts.
 */

const SEATS = [{ starterDeckId: "bishop-leadership" }, { starterDeckId: "magik-aggression" }] as const;
const SCENARIOS = ["unus", "four-horsemen", "apocalypse", "dark-beast", "en-sabah-nur"] as const;
type Mode = "standard" | "expert";
const MODES: readonly Mode[] = ["standard", "expert"];
const PLAYERS = [1, 2] as const;

const configOf = (id: string, mode: Mode, players: 1 | 2, seed = 1): GameSetupConfig =>
  wave8Scenario(id, { players: SEATS.slice(0, players), seed, difficulty: mode });

function build(config: GameSetupConfig): GameState {
  const created = createGame(config, WAVE8_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return created.state;
}
/** The game after its first villain phase: setup's choices declined until the first player phase. */
const firstRound = (state: GameState): GameState =>
  settle(state, firstLegal, (s) => s.step.phase === "player", WAVE8_DEPS);

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
/** How many cards of encounter set `setId` are in `ids`. */
const countIn = (ids: readonly string[], setId: string): number =>
  ids.filter((id) => {
    const card = WAVE8_CARDS.find((c) => c.id === id);
    return card && "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(setId);
  }).length;
const deckSets = (config: GameSetupConfig, sets: readonly string[]): Record<string, number> =>
  Object.fromEntries(sets.map((set) => [set, countIn(config.encounterDeck ?? [], set)]));
const villainsOf = (s: GameState) =>
  s.villains.map((v) => ({
    card: codeOf(s, v.instanceId),
    stage: villainStageOf(s, v.instanceId).stageNumber,
    hp: maxHitPoints(s, v.instanceId),
  }));
const inVillainArea = (s: GameState, code: string): InstanceId[] =>
  s.villainArea.filter((id) => codeOf(s, id) === code);
const setAsideCodes = (s: GameState): string[] => s.encounterSetAside.map((id) => codeOf(s, id));

interface Expectation {
  readonly villain: string;
  /** Villain card, stage number and hit points per player, by mode. */
  readonly stage: Record<Mode, number>;
  readonly hpPerPlayer: Record<Mode, number>;
  readonly mainScheme: string;
  /** The main scheme's starting threat per player. */
  readonly threatPerPlayer: number;
  /** Cards per encounter set in the built deck (the Expert set is added in expert mode). */
  readonly deck: Record<string, number>;
  readonly expertSetCards: number;
}
const DIFFICULTY_DECK = { standard: 7 };

const EXPECTED: Record<(typeof SCENARIOS)[number], Expectation> = {
  // unus 10, infinites 7 + Gene Pool, Dystopian Nightmare 6.
  unus: {
    villain: "45059",
    stage: { standard: 1, expert: 2 },
    hpPerPlayer: { standard: 12, expert: 15 },
    mainScheme: "45062a",
    threatPerPlayer: 0,
    deck: { unus: 10, infinites: 8, dystopian_nightmare: 6, ...DIFFICULTY_DECK },
    expertSetCards: 3,
  },
  "four-horsemen": {
    villain: "45081a",
    stage: { standard: 1, expert: 2 },
    hpPerPlayer: { standard: 9, expert: 12 },
    mainScheme: "45085a",
    threatPerPlayer: 0,
    deck: { four_horsemen: 15, dystopian_nightmare: 6, hounds: 7, ...DIFFICULTY_DECK },
    expertSetCards: 3,
  },
  // apocalypse 10 + Heart of the Empire (45104a); the Throne and the Prelates are set aside.
  apocalypse: {
    villain: "45101a",
    stage: { standard: 2, expert: 3 },
    hpPerPlayer: { standard: 9, expert: 10 },
    mainScheme: "45103a",
    threatPerPlayer: 1,
    deck: { apocalypse: 11, prelates: 0, dark_riders: 6, infinites: 8, ...DIFFICULTY_DECK },
    expertSetCards: 3,
  },
  "dark-beast": {
    villain: "45118",
    stage: { standard: 1, expert: 2 },
    hpPerPlayer: { standard: 15, expert: 18 },
    mainScheme: "45121a",
    threatPerPlayer: 1,
    deck: { dark_beast: 9, blue_moon: 0, genosha: 0, savage_land: 0, dystopian_nightmare: 6, ...DIFFICULTY_DECK },
    expertSetCards: 3,
  },
  "en-sabah-nur": {
    villain: "45184a",
    stage: { standard: 1, expert: 2 },
    hpPerPlayer: { standard: 16, expert: 20 },
    mainScheme: "45147a",
    threatPerPlayer: 1,
    deck: { en_sabah_nur: 11, celestial_tech: 4, clan_akkaba: 7, ...DIFFICULTY_DECK },
    expertSetCards: 3,
  },
};

describe("wave8Scenario", () => {
  it("covers exactly the five Age of Apocalypse scenarios", () => {
    expect(WAVE8_SCENARIOS.map((s) => s.id).sort()).toEqual([...SCENARIOS].sort());
  });

  it("refuses a scenario that is not one of the box's five", () => {
    expect(() => wave8Scenario("rhino", { players: SEATS.slice(0, 1), seed: 1 })).toThrow("no wave 8 scenario rhino");
  });

  describe.each(SCENARIOS)("%s", (id) => {
    const expected = EXPECTED[id];
    const isHorsemen = id === "four-horsemen";
    describe.each(MODES)("%s mode", (mode) => {
      describe.each(PLAYERS)("%i player(s)", (players) => {
        const config = configOf(id, mode, players);
        const expert = mode === "expert";

        it("sets up with the right villain stage, hit points, main scheme and starting threat", () => {
          const s = build(config);
          expect(s.mainScheme.cardId).toBe(expected.mainScheme);
          expect(inst(s, s.mainScheme.instanceId).threat).toBe(expected.threatPerPlayer * players);
          expect(config.difficulty).toBe(expert ? "expert" : undefined);
          const face = isHorsemen && expert ? "b" : "a";
          const cards = isHorsemen
            ? ["45081", "45082", "45083", "45084"].map((n) => `${n}${face}`)
            : [expected.villain];
          expect(villainsOf(s)).toEqual(
            cards.map((card) => ({
              card,
              stage: expected.stage[mode],
              hp: expected.hpPerPlayer[mode] * players,
            })),
          );
          expect(codeOf(s, s.activeVillainId!)).toBe(cards[0]);
        });

        it("builds the encounter deck from the right sets, and no others", () => {
          const sets = { ...expected.deck, ...(expert ? { expert: expected.expertSetCards } : { expert: 0 }) };
          expect(deckSets(config, Object.keys(sets))).toEqual(sets);
          // The deck holds no villain, main scheme or card of another set.
          const known = Object.keys(sets);
          const stray = (config.encounterDeck ?? []).filter(
            (card) => !known.some((set) => countIn([card as string], set) > 0),
          );
          expect(stray).toEqual([]);
        });

        it("runs a first villain phase to completion, the same every time for one seed", () => {
          const a = firstRound(build(config));
          const b = firstRound(build(configOf(id, mode, players)));
          expect(a.step.phase).toBe("player");
          expect(a.outcome).toBeFalsy();
          expect(JSON.stringify(b)).toBe(JSON.stringify(a));
          const other = firstRound(build(configOf(id, mode, players, 2)));
          expect(JSON.stringify(other)).not.toBe(JSON.stringify(a));
        });
      });
    });
  });

  describe("Unus", () => {
    it.each(PLAYERS)(
      "puts Gene Pool into play at its printed 4 threat through its Setup keyword (%i player(s))",
      (n) => {
        const s = build(configOf("unus", "standard", n));
        const pool = inVillainArea(s, "45071");
        expect(pool).toHaveLength(1);
        expect(inst(s, pool[0]!).threat).toBe(4);
        // Gene Pool is permanent, so it is never in the encounter deck once the game is built.
        expect(
          Object.values(s.encounterDecks)
            .flatMap((d) => d.deck)
            .map((id) => codeOf(s, id)),
        ).not.toContain("45071");
      },
    );

    it("takes one modular set, and the Infinites set is its own, never a modular pick", () => {
      const config = wave8Scenario("unus", { players: SEATS.slice(0, 1), seed: 1, modularSetIds: ["hounds"] });
      expect(countIn(config.encounterDeck ?? [], "hounds")).toBe(7);
      expect(countIn(config.encounterDeck ?? [], "dystopian_nightmare")).toBe(0);
      expect(() =>
        wave8Scenario("unus", { players: SEATS.slice(0, 1), seed: 1, modularSetIds: ["infinites"] }),
      ).toThrow(/infinites/);
    });
  });

  describe("Four Horsemen", () => {
    it("takes the villain version per Horseman, defaulting from the difficulty (Q9 = B)", () => {
      const sides = (config: GameSetupConfig) => config.villains!.map((v) => v.villainCardId);
      expect(sides(configOf("four-horsemen", "standard", 1))).toEqual(["45081a", "45082a", "45083a", "45084a"]);
      expect(sides(configOf("four-horsemen", "expert", 1))).toEqual(["45081b", "45082b", "45083b", "45084b"]);
      const mixed = wave8Scenario("four-horsemen", {
        players: SEATS.slice(0, 1),
        seed: 1,
        difficulty: "standard",
        horsemanSides: ["B", "A", "A", "B"],
      });
      expect(sides(mixed)).toEqual(["45081b", "45082a", "45083a", "45084b"]);
      const s = build(mixed);
      expect(villainsOf(s).map((v) => [v.card, v.stage, v.hp])).toEqual([
        ["45081b", 2, 12],
        ["45082a", 1, 9],
        ["45083a", 1, 9],
        ["45084b", 2, 12],
      ]);
      expect(mixed.sharedEncounterDeck).toBe(true);
      expect(mixed.villainCardId).toBe("45081b");
    });

    it("refuses a Horseman side pick at any other scenario", () => {
      expect(() =>
        wave8Scenario("unus", {
          players: SEATS.slice(0, 1),
          seed: 1,
          horsemanSides: ["A", "A", "A", "A"],
        }),
      ).toThrow(/Four Horsemen/);
    });

    // TODO(engine task 20, docs/phase7-wave8.md section 3.7): 45085a's Setup shuffles the Horsemen into a random row
    // and gives the leftmost the active counter, and each player reveals a random Four Horsemen side scheme. Neither
    // is built. This pins today's behavior and must change with that task: the row is the printed order, the first
    // villain is active, and the four Horsemen side schemes (45086 to 45089) are shuffled into the shared deck.
    it("pins today's setup: printed row order, War active, the side schemes still in the deck", () => {
      for (const seed of [1, 2, 3]) {
        const s = build(configOf("four-horsemen", "standard", 2, seed));
        expect(s.villains.map((v) => codeOf(s, v.instanceId))).toEqual(["45081a", "45082a", "45083a", "45084a"]);
        expect(codeOf(s, s.activeVillainId!)).toBe("45081a");
        const deck = Object.values(s.encounterDecks).flatMap((d) => d.deck.map((id) => codeOf(s, id)));
        for (const scheme of ["45086", "45087", "45088", "45089"]) expect(deck).toContain(scheme);
      }
    });
  });

  describe("Apocalypse", () => {
    const PRELATES = ["45179b", "45180b", "45181b", "45182b", "45183b"];
    it("sets the five Prelates and The Tyrant's Throne aside, and Heart of the Empire is in the deck", () => {
      const config = configOf("apocalypse", "standard", 1);
      expect([...(config.setAside ?? [])].sort()).toEqual([...PRELATES, "45105a"].sort());
      const deck = [...(config.encounterDeck ?? [])] as string[];
      expect(deck).toContain("45104a");
      for (const gone of [...PRELATES, "45105a", "45105b", "45104b"]) expect(deck).not.toContain(gone);
    });

    it.each(PLAYERS)("has the Throne and four Prelates aside once 45103a's Setup has revealed one (%i)", (n) => {
      const s = firstRound(build(configOf("apocalypse", "standard", n)));
      const aside = setAsideCodes(s);
      expect(aside).toContain("45105a");
      expect(aside.filter((code) => PRELATES.includes(code))).toHaveLength(4);
      expect(
        s.instances && Object.keys(s.instances).filter((id) => PRELATES.includes(codeOf(s, id as InstanceId))),
      ).toHaveLength(5);
    });
  });

  describe("Dark Beast", () => {
    const SETTINGS = ["blue_moon", "genosha", "savage_land"];
    it("sets the three Setting sets aside whole, and holds their environments back from step 11", () => {
      const config = configOf("dark-beast", "standard", 1);
      expect(config.setAsideModularSets?.map((set) => [set.encounterSetId, set.cardIds.length])).toEqual([
        ["blue_moon", 8],
        ["genosha", 8],
        ["savage_land", 8],
      ]);
      expect(config.setAsideUntilCalled?.encounterSetIds).toEqual(SETTINGS);
      // Every card the record names is in one of the sets.
      const aside = new Set(config.setAsideModularSets!.flatMap((set) => [...set.cardIds] as string[]));
      const record = WAVE8_SCENARIOS.find((r) => r.id === "dark-beast")!;
      for (const card of record.setAsideCardIds ?? []) expect(aside.has(card as string)).toBe(true);
      expect(config.setAside).toBeUndefined();
    });

    it.each(PLAYERS)("has exactly one Setting environment in play and the other two sets aside (%i)", (n) => {
      const s = build(configOf("dark-beast", "standard", n));
      expect(s.setAsideModularSets?.reduce((total, set) => total + set.instanceIds.length, 0)).toBe(16);
      const envs = ["45127", "45133", "45139"].filter((code) => inVillainArea(s, code).length > 0);
      expect(envs).toHaveLength(1);
    });

    it("starts at stage index 0 (last 1) in standard and 1 (last 2) in expert", () => {
      const standard = configOf("dark-beast", "standard", 1);
      const expert = configOf("dark-beast", "expert", 1);
      expect([standard.villainStartStageIndex, standard.villainLastStageIndex]).toEqual([0, 1]);
      expect([expert.villainStartStageIndex, expert.villainLastStageIndex]).toEqual([1, 2]);
    });
  });

  describe("En Sabah Nur", () => {
    it("is one villain card with three sides, started on side A over stages 0 to 1 (1 to 2 in expert)", () => {
      const standard = configOf("en-sabah-nur", "standard", 1);
      const expert = configOf("en-sabah-nur", "expert", 1);
      expect(standard.villainSide).toBe("A");
      expect([standard.villainStartStageIndex, standard.villainLastStageIndex]).toEqual([0, 1]);
      expect([expert.villainStartStageIndex, expert.villainLastStageIndex]).toEqual([1, 2]);
      const s = build(standard);
      expect(villainOf(s, s.activeVillainId!)!.side).toBe("A");
    });

    it("puts Clan Akkaba's Ancient Ritual into play at step 11", () => {
      const s = build(configOf("en-sabah-nur", "standard", 1));
      expect(inVillainArea(s, "45163")).toHaveLength(1);
    });
  });

  // TODO(engine task 18, docs/phase7-wave8.md section 3.5): the Infinites "Modular Difficulty" setup option (threat per
  // player on Gene Pool) is not built. This pins today's behavior: expert mode and two players leave Gene Pool at its
  // printed 4. When the option lands it stays off unless the players turn it on (Q1 = A), so this stays true.
  it("pins today's Gene Pool: 4 threat whatever the mode or player count", () => {
    for (const mode of MODES)
      for (const n of PLAYERS) {
        const s = build(configOf("unus", mode, n));
        expect(inst(s, inVillainArea(s, "45071")[0]!).threat).toBe(4);
      }
  });

  // TODO(engine task 19, docs/phase7-wave8.md section 3.6): Standard III as a standard-set choice (a counted
  // environment that flips, replacing the Standard set). Not built: the builder passes `difficultySets` straight
  // through like the other waves, so a pick swaps the set's cards into the deck without the environment's rules.
  // This pins that today's default is the plain Standard set and Standard III is absent.
  it("pins today's Standard set: the default is Standard, with no Standard III card dealt", () => {
    const config = configOf("unus", "standard", 1);
    expect(countIn(config.encounterDeck ?? [], "standard")).toBe(7);
    expect(countIn(config.encounterDeck ?? [], "standard_iii")).toBe(0);
  });
});
