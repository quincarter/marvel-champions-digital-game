/**
 * Wave 9 (cycle 9, Agents of S.H.I.E.L.D.) in the playable pool (docs/wave-definition-of-done.md step 5, cards half):
 * its six heroes and six scenarios are chosen through `playableScenario` like every earlier wave's. What is not
 * scripted yet is in the card data but not offered anywhere (`./unscripted.ts`); today that list is empty.
 */
import {
  CORE_STARTER_DECKS,
  PLAYABLE_CARDS,
  WAVE9_ENCOUNTER_SETS,
  WAVE9_SCENARIOS,
  WAVE9_STARTER_DECKS,
} from "@mc/content";
import { createGame, replay, validateDeck } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_ENCOUNTER_SETS, PLAYABLE_SCENARIO_RECORDS } from "../modular-pool.js";
import { MODULAR_SETS } from "../testing/modular-matrix.js";
import { playToOutcome } from "../testing/driver.js";
import { WAVE9_ABILITIES } from "../wave9/index.js";
import { PLAYABLE_ABILITIES, PLAYABLE_DEPS, playableScenario, playableStarterDeckSetup } from "./index.js";
import { GATED_THOUGH_SCRIPTED, UNSCRIPTED_ENCOUNTER_SET_IDS, scenarioIsScripted } from "./unscripted.js";

const NEW_HEROES = [
  "maria-hill-leadership",
  "nick-fury-justice",
  "bp-justice",
  "silk-protection",
  "falcon-leadership",
  "winter-aggression",
];
const NEW_SCENARIOS = ["black-widow", "batroc", "modok", "thunderbolts", "baron-zemo", "enchantress", "god-of-lies"];
const EXECUTIVE_BOARD = "s.h.i.e.l.d._executive_board";

const everyCardOf = (config: ReturnType<typeof playableScenario>): string[] => {
  const created = createGame(config, PLAYABLE_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return Object.values(created.state.instances).map((instance) => instance.cardId as string);
};

const cardsOfSets = (setIds: readonly string[]): Set<string> =>
  new Set(
    PLAYABLE_CARDS.filter(
      (card) =>
        "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).some((id) => setIds.includes(id)),
    ).map((card) => card.id as string),
  );

describe("wave 9 in the playable pool", () => {
  it("the six precons are playable starter decks and legal against the whole pool", () => {
    expect(WAVE9_STARTER_DECKS.map((d) => d.id as string)).toEqual(NEW_HEROES);
    for (const deck of WAVE9_STARTER_DECKS) {
      expect(playableStarterDeckSetup(deck.id as string).deck.length, deck.id).toBeGreaterThan(0);
      expect(validateDeck(deck, PLAYABLE_CARDS), deck.id).toEqual({ ok: true });
    }
  });

  it("every wave 9 ability is in the playable registry", () => {
    for (const [id, ability] of Object.entries(WAVE9_ABILITIES)) expect(PLAYABLE_ABILITIES[id], id).toBe(ability);
  });

  it("the seven scripted scenarios are the playable ones, God of Lies among them", () => {
    expect(WAVE9_SCENARIOS.filter(scenarioIsScripted).map((s) => s.id as string)).toEqual(NEW_SCENARIOS);
    const playable = new Set(PLAYABLE_SCENARIO_RECORDS.map((s) => s.id as string));
    for (const id of NEW_SCENARIOS) expect(playable.has(id), id).toBe(true);
  });

  it.each(NEW_SCENARIOS)("%s builds and starts a game through playableScenario, in both modes", (scenarioId) => {
    for (const difficulty of ["standard", "expert"] as const) {
      for (const seats of [NEW_HEROES.slice(0, 1), NEW_HEROES.slice(2, 4), NEW_HEROES.slice(0, 4)]) {
        const config = playableScenario(scenarioId, {
          seed: 3,
          difficulty,
          players: seats.map((starterDeckId) => ({ starterDeckId })),
        });
        expect(config.cards).toBe(PLAYABLE_CARDS);
        const created = createGame(config, PLAYABLE_DEPS);
        expect(created.ok, `${scenarioId} ${difficulty} ${seats.length}p`).toBe(true);
      }
    }
  });

  it.each(NEW_SCENARIOS)("%s seats a Core precon and an earlier wave's", (scenarioId) => {
    const config = playableScenario(scenarioId, {
      seed: 4,
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "bishop-leadership" }],
    });
    expect(createGame(config, PLAYABLE_DEPS).ok).toBe(true);
  });

  it('a wave 9 scenario refuses "extreme" and the earlier waves\' own choices', () => {
    const players = [{ starterDeckId: "maria-hill-leadership" }];
    expect(() => playableScenario("batroc", { seed: 1, difficulty: "extreme", players })).toThrow("cycle 9");
    expect(() => playableScenario("batroc", { seed: 1, players, horsemanSides: ["A", "A", "A", "A"] })).toThrow();
    expect(() => playableScenario("batroc", { seed: 1, players, easierStart: true })).toThrow();
  });

  it.each(["falcon-leadership", "maria-hill-leadership", "nick-fury-justice"])(
    "%s plays a seeded greedy game to an outcome that replays",
    (hero) => {
      const scenario =
        hero === "falcon-leadership" ? "batroc" : hero === "maria-hill-leadership" ? "black-widow" : "enchantress";
      const config = playableScenario(scenario, { seed: 2026, players: [{ starterDeckId: hero }] });
      const created = createGame(config, PLAYABLE_DEPS);
      if (!created.ok) throw new Error(created.error.message);
      const result = playToOutcome(created.state, PLAYABLE_DEPS);
      expect(result.outcome).not.toBeNull();
      const replayed = replay(result.session.log, PLAYABLE_DEPS);
      expect(replayed.ok).toBe(true);
      if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
    },
    120_000,
  );
});

describe("wave 9 modular sets", () => {
  it("no wave 9 set is gated any more: every wave 9 encounter set is a playable one", () => {
    // Nothing is gated now: Synthezoid Smackdown (cycle 10) was the last (`playable/unscripted.ts`).
    expect([...UNSCRIPTED_ENCOUNTER_SET_IDS].every((id) => WAVE9_ENCOUNTER_SETS.every((set) => set.id !== id))).toBe(
      true,
    );
    expect(Object.keys(GATED_THOUGH_SCRIPTED).every((id) => UNSCRIPTED_ENCOUNTER_SET_IDS.has(id))).toBe(true);
    for (const set of WAVE9_ENCOUNTER_SETS)
      expect(UNSCRIPTED_ENCOUNTER_SET_IDS.has(set.id as string), set.id).toBe(false);
    const playable = new Set(PLAYABLE_ENCOUNTER_SETS.map((s) => s.id as string));
    const own = new Set(WAVE9_SCENARIOS.flatMap((s) => s.encounterSetIds as readonly string[]));
    for (const id of own) expect(playable.has(id), id).toBe(true);
    expect(WAVE9_ENCOUNTER_SETS.some((s) => s.id === "god_of_lies")).toBe(true);
  });

  it("the scripted wave 9 modular sets are offered", () => {
    const modular = new Set(MODULAR_SETS.map((s) => s.id as string));
    for (const id of [
      "a.i.m._abduction",
      "a.i.m._science",
      "batrocs_brigade",
      "scientist_supreme",
      "s.h.i.e.l.d.",
      "trickster_magic",
    ])
      expect(modular.has(id), id).toBe(true);
    // Thunderbolt minion sets are offered at the Thunderbolts scenario only (its pool); a pool member is a modular set elsewhere too.
  });

  it.each(["a.i.m._abduction", "batrocs_brigade", "scientist_supreme", "s.h.i.e.l.d."])(
    "%s can be the modular set of a Core scenario, and its cards are in the game",
    (setId) => {
      const config = playableScenario("rhino", {
        seed: 2,
        players: [{ starterDeckId: "core-spider-man-justice" }],
        modularSetIds: [setId],
      });
      const inGame = new Set(everyCardOf(config));
      expect([...cardsOfSets([setId])].some((id) => inGame.has(id))).toBe(true);
    },
  );

  it("the Thunderbolts pool holds Techno (Falcon, scripted) and draws it: its cards are in the game, set aside with the other sets", () => {
    const thunderbolts = PLAYABLE_SCENARIO_RECORDS.find((s) => s.id === "thunderbolts")!;
    expect(thunderbolts.modularSetPool?.setIds).toContain("techno");
    const techno = cardsOfSets(["techno"]);
    expect(techno.size).toBe(5);
    const drawing: number[] = [];
    for (let seed = 1; seed <= 25; seed++) {
      const config = playableScenario("thunderbolts", { seed, players: [{ starterDeckId: NEW_HEROES[0]! }] });
      const aside = (config.setAsideModularSets ?? []).map((set) => set.encounterSetId as string);
      if (aside.includes("techno")) {
        drawing.push(seed);
        expect(everyCardOf(config).filter((id) => techno.has(id)).length).toBeGreaterThan(0);
      }
    }
    expect(drawing.length).toBeGreaterThan(0);
  });

  it("the Executive Board, an extra modular set, joins any scenario once and Baron Zemo already requires it", () => {
    const players = [{ starterDeckId: "nick-fury-justice" }];
    const board = cardsOfSets([EXECUTIVE_BOARD]);
    expect(board.size).toBeGreaterThan(0);
    const plain = playableScenario("batroc", { players, seed: 7 });
    const withBoard = playableScenario("batroc", { players, seed: 7, extraModularSetIds: [EXECUTIVE_BOARD] });
    expect((withBoard.encounterDeck ?? []).length).toBeGreaterThan((plain.encounterDeck ?? []).length);
    expect(createGame(withBoard, PLAYABLE_DEPS).ok).toBe(true);
    // An earlier wave's scenario takes it too.
    const rhino = playableScenario("rhino", { players, seed: 7, extraModularSetIds: [EXECUTIVE_BOARD] });
    expect(createGame(rhino, PLAYABLE_DEPS).ok).toBe(true);
    // Baron Zemo: asking for it changes nothing.
    const zemo = playableScenario("baron-zemo", { players, seed: 7 });
    const zemoAgain = playableScenario("baron-zemo", { players, seed: 7, extraModularSetIds: [EXECUTIVE_BOARD] });
    expect(zemoAgain.encounterDeck).toEqual(zemo.encounterDeck);
    expect(everyCardOf(zemo).some((id) => board.has(id))).toBe(true);
  });
});

describe("the Core precons are untouched by the wave 9 pool", () => {
  it("stay legal", () => {
    for (const deck of CORE_STARTER_DECKS) expect(validateDeck(deck, PLAYABLE_CARDS), deck.id).toEqual({ ok: true });
  });
});
