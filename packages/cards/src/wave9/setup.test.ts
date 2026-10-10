import { WAVE9_CARDS, WAVE9_STARTER_DECKS } from "@mc/content";
import { createGame, type GameSetupConfig, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { WAVE9_DEPS } from "./index.js";
import { wave9Scenario, wave9StarterDeckSetup } from "./setup.js";

/**
 * The wave 9 builders at the scaffold: every scenario and every starter deck is built and the game created, nothing
 * is played (every wave 9 card is still unscripted).
 */

const SCENARIOS = [
  "black-widow",
  "batroc",
  "modok",
  "thunderbolts",
  "baron-zemo",
  "enchantress",
  "god-of-lies",
] as const;
const SEATS = [{ starterDeckId: "maria-hill-leadership" }, { starterDeckId: "nick-fury-justice" }] as const;
const MODES = ["standard", "expert"] as const;

function build(config: GameSetupConfig): GameState {
  const created = createGame(config, WAVE9_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return created.state;
}
const codeOf = (s: GameState, id: string): string => s.instances[id as keyof GameState["instances"]]!.cardId as string;

describe("wave9Scenario", () => {
  describe.each(SCENARIOS)("%s", (id) => {
    it.each(MODES)("builds in %s mode for one and two players", (mode) => {
      for (const players of [1, 2] as const) {
        const config = wave9Scenario(id, { players: SEATS.slice(0, players), seed: 1, difficulty: mode });
        expect(config.encounterDeck?.length, `${id} ${mode} ${players}p deck`).toBeGreaterThan(0);
        expect(() => build(config)).not.toThrow();
      }
    });
  });

  it("never deals an evidence card into the encounter deck", () => {
    const config = wave9Scenario("baron-zemo", { players: SEATS, seed: 1 });
    const types = new Map(WAVE9_CARDS.map((c) => [c.id as string, c.type]));
    expect((config.encounterDeck ?? []).filter((c) => types.get(c) === "evidence")).toEqual([]);
  });

  it("plays Baron Zemo's A face in standard mode and his expert card in expert mode", () => {
    expect(wave9Scenario("baron-zemo", { players: SEATS, seed: 1 }).villainCardId).toBe("50165a");
    expect(wave9Scenario("baron-zemo", { players: SEATS, seed: 1, difficulty: "expert" }).villainCardId).toBe("50166a");
  });

  it("sets aside the Rescued Captives (Batroc) and the Adaptoid environments (M.O.D.O.K.) out of their decks", () => {
    const batroc = wave9Scenario("batroc", { players: SEATS, seed: 1 });
    expect(batroc.setAside).toEqual(["50091", "50091", "50091", "50091"]);
    expect(batroc.encounterDeck).not.toContain("50091");
    const modok = wave9Scenario("modok", { players: SEATS, seed: 1 });
    expect(modok.setAside).toEqual(expect.arrayContaining(["50109", "50112"]));
    for (const id of modok.setAside ?? []) expect(modok.encounterDeck).not.toContain(id);
  });

  it("M.O.D.O.K.'s Holding Cell a-sides stay in the encounter deck, once each, for the separate deck; the b-sides do not", () => {
    const modok = wave9Scenario("modok", { players: SEATS, seed: 1 });
    expect(modok.scenarioDecks).toEqual([
      expect.objectContaining({ name: "Holding Cell", topCardInPlay: true, discardPile: "none" }),
    ]);
    for (const id of ["50105a", "50106a", "50107a", "50108a"]) {
      expect(modok.setAside ?? []).not.toContain(id);
      expect(modok.encounterDeck.filter((c) => c === id)).toHaveLength(1);
    }
    for (const id of ["50105b", "50106b", "50107b", "50108b"]) expect(modok.encounterDeck).not.toContain(id);
  });

  it("Thunderbolts sets aside one modular set plus one per player, from its restricted pool", () => {
    const pool = [
      "gravitational_pull",
      "hard_sound",
      "pale_little_spider",
      "power_of_the_atom",
      "supersonic",
      "the_leaper",
    ];
    for (const players of [1, 2] as const) {
      const config = wave9Scenario("thunderbolts", { players: SEATS.slice(0, players), seed: 3 });
      const aside = (config.setAsideModularSets ?? []).map((s) => s.encounterSetId as string);
      expect(aside).toHaveLength(1 + players);
      for (const set of aside) expect(pool).toContain(set);
    }
    expect(() =>
      wave9Scenario("thunderbolts", { players: SEATS, seed: 1, setAsideModularSetIds: ["batroc"] }),
    ).toThrow();
  });

  it("God of Lies starts the first Avatar and sets the other three aside; Loki and Worlds Collide are neutral cards", () => {
    const config = wave9Scenario("god-of-lies", { players: SEATS, seed: 1 });
    // The record is `startingVillain: "bySetup"` with `neutralCards` (docs/phase7-wave9.md 1.15); the builder does not read
    // either yet (engine tasks 42 to 47), so 55029a is the villain in play until it does, and nothing is set aside.
    expect(config.villainCardId).toBe("55029a");
    expect(config.setAsideVillainCardIds).toEqual(["55030a", "55031a", "55032a"]);
    expect(config.setAside).toBeUndefined();
  });

  it("refuses a scenario id that is not a wave 9 scenario", () => {
    expect(() => wave9Scenario("rhino", { players: SEATS, seed: 1 })).toThrow(/no wave 9 scenario/);
  });
});

describe("wave9StarterDeckSetup", () => {
  it.each(WAVE9_STARTER_DECKS.map((d) => [d.id, d] as const))("%s expands to its listed cards", (id, deck) => {
    const setup = wave9StarterDeckSetup(id);
    expect(setup.identityCardId).toBe(deck.identityCardId);
    expect(setup.aspects).toEqual(deck.aspects);
    expect(setup.deck).toHaveLength(deck.cards.reduce((n, c) => n + c.quantity, 0));
  });

  it("builds six wave 9 starter decks", () => {
    expect(WAVE9_STARTER_DECKS).toHaveLength(6);
  });

  it.each(WAVE9_STARTER_DECKS.map((d) => d.id))("%s seats in a Black Widow game", (id) => {
    const state = build(wave9Scenario("black-widow", { players: [{ starterDeckId: id }], seed: 2 }));
    expect(state.players).toHaveLength(1);
  });

  it("starts Nick Fury's Assault / Stealth in play, outside his 40 cards", () => {
    const state = build(wave9Scenario("black-widow", { players: [{ starterDeckId: "nick-fury-justice" }], seed: 2 }));
    const player = state.players[0]!;
    const inPlay = Object.values(state.instances).filter((i) => (i.cardId as string) === "50035a");
    expect(inPlay).toHaveLength(1);
    const deckAndHand = [...player.deck, ...player.hand].map((id) => codeOf(state, id as string));
    expect(deckAndHand).not.toContain("50035a");
    expect(deckAndHand).toHaveLength(40);
  });
});
