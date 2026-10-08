import {
  CORE_SCENARIOS,
  WAVE1_SCENARIOS,
  WAVE4_SCENARIOS,
  WAVE7_SCENARIOS,
  WAVE8_CARDS,
  WAVE8_ENCOUNTER_SETS,
  WAVE8_SCENARIOS,
  difficultyEncounterSetIds,
  encounterSetId,
} from "@mc/content";
import {
  createGame,
  hasKeyword,
  keywordTotal,
  maxHitPoints,
  villainOf,
  villainStageOf,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { P1, P2, endTurn, firstLegal, inst, settle } from "../testing/harness.js";
import { driveEventsPicking } from "../testing/staging.js";
import { WAVE8_DEPS } from "./index.js";
import { infinitesGenePoolThreatRecommendation } from "./aoa/infinites.js";
import { offersGenePoolThreat, standardSetReplaceable, wave8Scenario } from "./setup.js";

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
          // One villain: that villain. The Horsemen: the leftmost of the row 45085a's Setup shuffled.
          expect(s.activeVillainId).toBe(isHorsemen ? s.villainRow![0] : s.villains[0]!.instanceId);
          expect(s.villains.every((v) => !v.defeated)).toBe(true);
          expect("villainRow" in s).toBe(isHorsemen);
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

    describe("45085a's Setup (docs/phase7-wave8.md section 3.7, 3.15; MC45 p. 11)", () => {
      const HORSEMEN = ["45081a", "45082a", "45083a", "45084a"];
      const SCHEMES = ["45086", "45087", "45088", "45089"];
      const horsemen = (players: 1 | 2 | 3 | 4, seed: number) =>
        wave8Scenario("four-horsemen", {
          players: [
            { starterDeckId: "bishop-leadership" },
            { starterDeckId: "magik-aggression" },
            { starterDeckId: "core-spider-man-justice" },
            { starterDeckId: "core-captain-marvel-leadership" },
          ].slice(0, players),
          seed,
          difficulty: "standard",
        });
      const rowOf = (s: GameState) => (s.villainRow ?? []).map((id) => codeOf(s, id));
      const created = (config: GameSetupConfig) => {
        const result = createGame(config, WAVE8_DEPS);
        if (!result.ok) throw new Error(result.error.message);
        return result;
      };

      it("the four Horsemen start set aside, as the record says, and the Setup puts all four into play", () => {
        const config = configOf("four-horsemen", "standard", 2);
        expect(WAVE8_SCENARIOS.find((r) => r.id === "four-horsemen")!.multipleVillains!.atSetup).toBe("setAside");
        expect(config.villainsStartSetAside).toBe(true);
        const s = build(config);
        expect(s.villains.map((v) => v.defeated)).toEqual([false, false, false, false]);
        expect(s.encounterSetAside.filter((id) => HORSEMEN.includes(codeOf(s, id)))).toEqual([]);
        // Each entered with its tough status card and no damage.
        for (const v of s.villains) expect(inst(s, v.instanceId)).toMatchObject({ damage: 0, faceup: true });
      });

      it("the row is a seeded shuffle of the four, logged as `villainRowSet`, with the active counter on the leftmost", () => {
        const rows = new Set<string>();
        const leftmost = new Set<string>();
        for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
          const result = created(horsemen(2, seed));
          const s = result.state;
          expect([...rowOf(s)].sort(), `seed ${seed}`).toEqual(HORSEMEN);
          expect(result.events.filter((e) => e.type === "villainRowSet")).toEqual([
            { type: "villainRowSet", order: s.villainRow },
          ]);
          expect(s.activeVillainId).toBe(s.villainRow![0]);
          // `villains` stays in printed order whatever the row.
          expect(s.villains.map((v) => codeOf(s, v.instanceId))).toEqual(HORSEMEN);
          // The same seed gives the same row.
          expect(rowOf(created(horsemen(2, seed)).state)).toEqual(rowOf(s));
          rows.add(rowOf(s).join(","));
          leftmost.add(rowOf(s)[0]!);
        }
        // Not the printed order every time, and not War on the left every time.
        expect(rows.size).toBeGreaterThan(1);
        expect(leftmost.size).toBeGreaterThan(1);
      });

      it.each([1, 2, 3, 4] as const)(
        "%i player(s): each reveals a random side scheme of the set at its printed 6 threat; the rest stay in the deck, shuffled once after",
        (players) => {
          for (const seed of [1, 2, 3]) {
            const result = created(horsemen(players, seed));
            const s = result.state;
            const inPlay = s.villainArea.map((id) => codeOf(s, id)).filter((code) => SCHEMES.includes(code));
            expect(new Set(inPlay).size, `seed ${seed}`).toBe(players);
            expect(inPlay).toHaveLength(players);
            for (const id of s.villainArea.filter((card) => SCHEMES.includes(codeOf(s, card))))
              expect(inst(s, id).threat, codeOf(s, id)).toBe(6);
            const deck = Object.values(s.encounterDecks).flatMap((d) => d.deck.map((id) => codeOf(s, id)));
            expect(deck.filter((code) => SCHEMES.includes(code)).sort()).toEqual(
              SCHEMES.filter((code) => !inPlay.includes(code)),
            );
            // The setup shuffle (step 6) and the one after the Setup's search.
            const shuffles = result.events.filter((e) => e.type === "deckShuffled" && e.zone.kind === "encounterDeck");
            expect(shuffles).toHaveLength(2);
          }
        },
      );

      it("which schemes come out is random: different seeds reveal different ones", () => {
        const picks = new Set(
          [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
            const s = created(horsemen(1, seed)).state;
            return s.villainArea.map((id) => codeOf(s, id)).find((code) => SCHEMES.includes(code));
          }),
        );
        expect(picks.size).toBeGreaterThan(1);
      });

      it("the first villain phase: every villain activation passes the counter one place along the row from its holder", () => {
        for (const seed of [1, 2, 3]) {
          const s = firstRound(build(horsemen(2, seed)));
          const row = s.villainRow!;
          expect(s.activeVillainId).toBe(row[0]);
          const run = driveEventsPicking(WAVE8_DEPS, s, firstLegal, endTurn(P1), endTurn(P2));
          const activations = run.events.filter(
            (e) => (e.type === "attackResolved" || e.type === "schemeResolved") && row.includes(e.enemyInstanceId),
          );
          const moves = run.events.filter((e) => e.type === "activeVillainChanged");
          // At least the two of step two (one per player), plus any a Horseman treachery or boost card started.
          expect(activations.length, `seed ${seed}`).toBeGreaterThanOrEqual(2);
          expect(moves.filter((e) => e.type === "activeVillainChanged" && e.reason === "nextInRow")).toHaveLength(
            activations.length,
          );
          let holder = row[0]!;
          for (const move of moves) {
            if (move.type !== "activeVillainChanged") continue;
            expect(move.from).toBe(holder);
            // 1B's step along the row; any other move is a card's own (Metal Wings takes the counter to Death).
            if (move.reason === "nextInRow") expect(move.to).toBe(row[(row.indexOf(holder) + 1) % row.length]);
            else expect(move.reason).toBe("effect");
            holder = move.to;
          }
          expect(run.state.activeVillainId).toBe(holder);
          expect(run.state.villainRow).toEqual(row);
        }
      });
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

  describe("the Infinites set's Modular Difficulty (MC45 p. 8; docs/phase7-wave8.md section 3.5, Q1 = A)", () => {
    const pool = (s: GameState) => inst(s, inVillainArea(s, "45071")[0]!).threat;
    const unus = (s: GameState) => s.villains[0]!.instanceId;
    const applied = (config: GameSetupConfig) => {
      const created = createGame(config, WAVE8_DEPS);
      if (!created.ok) throw new Error(created.error.message);
      return created.events.filter((event) => event.type === "setupOptionApplied");
    };
    const withThreat = (id: string, n: 1 | 2, perPlayer: number | undefined, mode: Mode = "standard") =>
      wave8Scenario(id, {
        players: SEATS.slice(0, n),
        seed: 1,
        difficulty: mode,
        ...(perPlayer === undefined ? {} : { genePoolThreatPerPlayer: perPlayer }),
      });

    it("left off, Gene Pool holds its printed 4 whatever the mode or player count, and nothing is logged", () => {
      for (const mode of MODES)
        for (const n of PLAYERS) {
          const config = configOf("unus", mode, n);
          expect(config.setupOptions).toBeUndefined();
          expect(pool(build(config))).toBe(4);
          expect(applied(config)).toEqual([]);
        }
    });

    it("2 players at 2 per player: Gene Pool at 8, so Unus has retaliate 1 and stalwart at once", () => {
      const config = withThreat("unus", 2, 2);
      const s = build(config);
      expect(pool(s)).toBe(8);
      expect(keywordTotal(s, unus(s), "retaliate", WAVE8_DEPS)).toBe(1);
      expect(hasKeyword(s, unus(s), "stalwart", WAVE8_DEPS)).toBe(true);
      expect(applied(config)).toEqual([
        {
          type: "setupOptionApplied",
          option: "infinites.gene-pool-threat",
          amount: 2,
          text: "Modular Difficulty: Place 2[per_hero] threat on Gene Pool.",
          citation: "MC45 p. 8",
        },
      ]);
      // Without it the same table has retaliate 1 (4 threat) and no stalwart.
      const plain = build(configOf("unus", "standard", 2));
      expect(keywordTotal(plain, unus(plain), "retaliate", WAVE8_DEPS)).toBe(1);
      expect(hasKeyword(plain, unus(plain), "stalwart", WAVE8_DEPS)).toBe(false);
    });

    it.each([
      [1, 1, 5],
      [1, 3, 7],
      [2, 1, 6],
      [2, 3, 10],
    ] as const)("%i player(s) at %i per player: Gene Pool at %i", (n, perPlayer, threat) => {
      expect(pool(build(withThreat("unus", n, perPlayer)))).toBe(threat);
    });

    it("stated at 0 is off: 4 threat and no log entry", () => {
      const config = withThreat("unus", 2, 0);
      expect(config.setupOptions).toBeUndefined();
      expect(pool(build(config))).toBe(4);
      expect(applied(config)).toEqual([]);
    });

    it("expert mode does not fill the amount in: left off it is 4, not 8, and a stated 1 is 6", () => {
      expect(pool(build(withThreat("unus", 2, undefined, "expert")))).toBe(4);
      expect(pool(build(withThreat("unus", 2, 1, "expert")))).toBe(6);
    });

    it("belongs to the set, not the scenario: Apocalypse takes it, a game without Infinites refuses it", () => {
      expect(pool(build(withThreat("apocalypse", 2, 2)))).toBe(8);
      expect(offersGenePoolThreat(["unus", "infinites", "standard"])).toBe(true);
      expect(offersGenePoolThreat(["dark_beast", "dystopian_nightmare", "standard"])).toBe(false);
      for (const id of ["four-horsemen", "dark-beast", "en-sabah-nur"]) {
        expect(() => withThreat(id, 1, 2), id).toThrow(/Infinites/);
        expect(() => withThreat(id, 1, 0), id).toThrow(/Infinites/);
        expect(configOf(id, "expert", 2).setupOptions).toBeUndefined();
      }
    });

    it("refuses an amount outside 0 to 3 or not whole", () => {
      for (const amount of [4, -1, 1.5]) expect(() => withThreat("unus", 1, amount)).toThrow(/1 to 3 per player/);
    });

    it("the rulebook's recommendations are only where the control starts: 0, 1, 2, 3 by mode", () => {
      expect(infinitesGenePoolThreatRecommendation({ skirmish: { villainVersion: "A" } })).toBe(0);
      expect(infinitesGenePoolThreatRecommendation({})).toBe(1);
      expect(infinitesGenePoolThreatRecommendation({ expert: true })).toBe(2);
      expect(infinitesGenePoolThreatRecommendation({ expert: true, heroic: 1 })).toBe(3);
    });
  });

  describe("Standard III in place of the Standard set (docs/phase7-wave8.md section 3.6, Q10 = A)", () => {
    const STANDARD_III = encounterSetId("standard_iii");
    const withIII = (id: string, mode: Mode, players: 1 | 2 = 1) =>
      wave8Scenario(id, {
        players: SEATS.slice(0, players),
        seed: 1,
        difficulty: mode,
        difficultySets: { standard: STANDARD_III },
      });

    it("the default is the Standard set, with no Standard III card dealt", () => {
      const config = configOf("unus", "standard", 1);
      expect(countIn(config.encounterDeck ?? [], "standard")).toBe(7);
      expect(countIn(config.encounterDeck ?? [], "standard_iii")).toBe(0);
    });

    it.each(SCENARIOS)(
      "%s takes it: Standard III's 8 cards replace Standard's 7; the Expert set is unchanged",
      (id) => {
        for (const mode of MODES) {
          const config = withIII(id, mode);
          const deck = config.encounterDeck ?? [];
          expect(countIn(deck, "standard"), mode).toBe(0);
          expect(countIn(deck, "standard_iii"), mode).toBe(8);
          expect(countIn(deck, "expert"), mode).toBe(mode === "expert" ? 3 : 0);
          // Everything else is the deck the Standard set gives.
          const plain = configOf(id, mode, 1).encounterDeck ?? [];
          const other = (cards: readonly string[]) =>
            cards.filter((card) => countIn([card], "standard") + countIn([card], "standard_iii") === 0).sort();
          expect(other(deck as readonly string[])).toEqual(other(plain as readonly string[]));
        }
      },
    );

    it.each(SCENARIOS)("%s: Pursued by the Past starts in play on side A with no counters, and the game runs", (id) => {
      const s = build(withIII(id, "standard", 2));
      const pursued = inVillainArea(s, "45075a");
      expect(pursued).toHaveLength(1);
      expect(inst(s, pursued[0]!).counters["pursuit"] ?? 0).toBe(0);
      expect(inst(s, pursued[0]!).flipped).toBe(false);
      const deck = Object.values(s.encounterDecks).flatMap((d) => d.deck.map((card) => codeOf(s, card)));
      expect(deck).not.toContain("45075a");
      // Dark Designs x2, Sinister Strike x2, Evil Alliance, Nowhere is Safe, Drawing Near.
      expect(countIn(deck, "standard_iii")).toBe(7);
      const played = firstRound(s);
      expect(played.step.phase).toBe("player");
      expect(played.outcome).toBeFalsy();
    });

    it("refuses a set that is not of the Standard classification, and Standard III as the Expert set", () => {
      const pick = (difficultySets: { standard?: string; expert?: string }) => () =>
        wave8Scenario("unus", {
          players: SEATS.slice(0, 1),
          seed: 1,
          difficulty: "expert",
          difficultySets: {
            ...(difficultySets.standard ? { standard: encounterSetId(difficultySets.standard) } : {}),
            ...(difficultySets.expert ? { expert: encounterSetId(difficultySets.expert) } : {}),
          },
        });
      expect(pick({ standard: "hounds" })).toThrow(/not in the standard classification/);
      expect(pick({ standard: "expert" })).toThrow(/not in the standard classification/);
      expect(pick({ standard: "standard_iv" })).toThrow(/not a known encounter set/);
      expect(pick({ expert: "standard_iii" })).toThrow(/not in the expert classification/);
    });

    it("is never a modular pick: the set is of the Standard classification", () => {
      expect(WAVE8_ENCOUNTER_SETS.find((set) => set.id === "standard_iii")?.classification).toBe("standard");
      expect(() =>
        wave8Scenario("unus", { players: SEATS.slice(0, 1), seed: 1, modularSetIds: ["standard_iii"] }),
      ).toThrow(/standard_iii/);
    });

    it("reads the scenario record, not the pack: any scenario whose Standard set is [standard] takes it", () => {
      for (const scenario of WAVE8_SCENARIOS) expect(standardSetReplaceable(scenario), scenario.id).toBe(true);
      // Earlier packs' records: Core, cycle 1 (The Wrecking Crew requires no Standard set), cycle 3, cycle 7.
      const earlier = [...CORE_SCENARIOS, ...WAVE1_SCENARIOS, ...WAVE4_SCENARIOS, ...WAVE7_SCENARIOS];
      const usesStandard = earlier.filter((scenario) => standardSetReplaceable(scenario));
      const noStandard = earlier.filter((scenario) => scenario.standardEncounterSetIds.length === 0);
      expect(usesStandard.map((scenario) => scenario.id)).toContain("rhino");
      expect(noStandard.length).toBeGreaterThan(0);
      for (const scenario of usesStandard) {
        expect(difficultyEncounterSetIds(scenario, "standard", { standard: STANDARD_III }), scenario.id).toEqual([
          STANDARD_III,
        ]);
        // The Expert set is the scenario's own.
        expect(difficultyEncounterSetIds(scenario, "expert", { standard: STANDARD_III }), scenario.id).toEqual([
          STANDARD_III,
          ...scenario.expertEncounterSetIds,
        ]);
      }
      // A scenario that requires no Standard set gets none: the choice substitutes, it never adds.
      for (const scenario of noStandard) {
        expect(standardSetReplaceable(scenario), scenario.id).toBe(false);
        expect(difficultyEncounterSetIds(scenario, "standard", { standard: STANDARD_III }), scenario.id).toEqual([]);
      }
    });
  });
});
