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

  describe("God of Lies (startingVillain bySetup, neutralCards)", () => {
    it("starts every Avatar set aside for Mischief and Mayhem 1A's Setup, the other three as set-aside villains", () => {
      const config = wave9Scenario("god-of-lies", { players: SEATS, seed: 1 });
      expect(config.villainCardId).toBe("55029a");
      expect(config.villainsStartSetAside).toBe(true);
      expect(config.setAsideVillainCardIds).toEqual(["55030a", "55031a", "55032a"]);
      expect(build(config).villains.map((v) => codeOf(build(config), v.instanceId as string))).toContain("55029a");
    });

    it("does not set aside a villain for any scenario that is not bySetup", () => {
      for (const id of SCENARIOS.filter((s) => s !== "god-of-lies"))
        expect(wave9Scenario(id, { players: SEATS, seed: 1 }).villainsStartSetAside).toBeUndefined();
    });

    it("never deals Loki, God of Lies or Worlds Collide into the encounter deck", () => {
      const config = wave9Scenario("god-of-lies", { players: SEATS, seed: 1 });
      for (const id of ["55027a", "55027b", "55028a", "55028b"]) expect(config.encounterDeck).not.toContain(id);
    });

    it.todo(
      "puts Loki, God of Lies (55027a) and Worlds Collide (55028a) in a closed `neutral` area (engine task 44 to 46, section 3.59)",
    );
    it.todo("reads the shared record: Loki 20 hit points, Worlds Collide target 2 (engine task 46, section 3.66)");
    it.todo(
      "puts one random Avatar into play and the Synergy environments via 55033a's Setup (God of Lies script, section 3.59)",
    );
  });

  describe("permanent cards are set aside by keyword (docs/phase7-wave9.md 8.1 item 27)", () => {
    const keywordsOf = (id: string): string[] =>
      ((WAVE9_CARDS.find((c) => c.id === id) as { keywords?: { name: string }[] } | undefined)?.keywords ?? []).map(
        (k) => k.name,
      );
    const count = (ids: readonly string[] | undefined, id: string): number =>
      (ids ?? []).filter((c) => c === id).length;

    it("sets the five Hypnotic Gaze aside for Enchantress and shuffles none", () => {
      const config = wave9Scenario("enchantress", { players: SEATS, seed: 1 });
      for (const id of ["55007a", "55008a", "55009a", "55010a", "55011a"]) {
        expect(keywordsOf(id)).toContain("permanent");
        expect(count(config.setAside, id), id).toBe(1);
        expect(config.encounterDeck, id).not.toContain(id);
      }
    });

    it("sets Intense Focus and the four Synergy environments aside for God of Lies", () => {
      const config = wave9Scenario("god-of-lies", { players: SEATS, seed: 1 });
      for (const id of ["55034a", "55052", "55053", "55054", "55055"]) {
        expect(count(config.setAside, id), id).toBe(1);
        expect(config.encounterDeck, id).not.toContain(id);
      }
    });

    it("deals every other card of those sets, and a permanent card with the setup keyword stays dealt", () => {
      const config = wave9Scenario("god-of-lies", { players: SEATS, seed: 1 });
      expect(config.encounterDeck.length).toBeGreaterThan(10);
      for (const id of config.setAside ?? []) expect(keywordsOf(id)).not.toContain("setup");
      for (const id of config.encounterDeck) {
        const names = keywordsOf(id);
        expect(names.includes("permanent") && !names.includes("setup"), id).toBe(false);
      }
    });

    it("sets Trickster Magic's four linked allies aside whenever the set is in the game, and only then", () => {
      const allies = ["55063", "55064", "55065", "55066"];
      for (const id of ["enchantress", "god-of-lies"] as const) {
        const config = wave9Scenario(id, { players: SEATS, seed: 1 });
        for (const ally of allies) {
          expect(count(config.setAside, ally), `${id} ${ally}`).toBe(1);
          expect(config.encounterDeck).not.toContain(ally);
        }
      }
      expect(wave9Scenario("black-widow", { players: SEATS, seed: 1 }).setAside ?? []).not.toContain("55063");
    });

    it("builds Enchantress and God of Lies with the permanent cards set aside", () => {
      expect(() => build(wave9Scenario("enchantress", { players: SEATS, seed: 1 }))).not.toThrow();
      expect(() => build(wave9Scenario("god-of-lies", { players: SEATS, seed: 1 }))).not.toThrow();
    });
  });

  describe("double-sided encounter cards", () => {
    it("deals the S.H.I.E.L.D. Executive Board's a faces once each and never a b face", () => {
      // Baron Zemo's record lists the set; the set is not `extraModular` in the data yet (item 9), so no extra route here.
      const config = wave9Scenario("baron-zemo", { players: SEATS, seed: 1 });
      for (const id of ["50181a", "50182a", "50183a"])
        expect(config.encounterDeck.filter((c) => c === id)).toHaveLength(1);
      for (const id of ["50181b", "50182b", "50183b"]) {
        expect(config.encounterDeck, id).not.toContain(id);
        expect(config.setAside ?? [], id).not.toContain(id);
      }
    });

    it("never deals any card that is the b face of another card in the deck", () => {
      for (const id of SCENARIOS) {
        const config = wave9Scenario(id, { players: SEATS, seed: 1 });
        const deck = new Set<string>(config.encounterDeck);
        const faces = new Map(WAVE9_CARDS.map((c) => [c.id as string, c.otherFaceId as string | undefined]));
        for (const card of deck) {
          const other = faces.get(card);
          expect(other === undefined || !deck.has(other) || card < other, `${id} ${card}`).toBe(true);
        }
      }
    });
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
