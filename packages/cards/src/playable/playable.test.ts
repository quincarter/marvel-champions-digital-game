import {
  PLAYABLE_CARDS,
  WAVE1_CARDS,
  WAVE1_STARTER_DECKS,
  WAVE2_CARDS,
  WAVE2_STARTER_DECKS,
  WAVE3_CARDS,
  WAVE3_SCENARIOS,
  WAVE3_STARTER_DECKS,
  WAVE4_CARDS,
  WAVE4_SCENARIOS,
  WAVE4_STARTER_DECKS,
} from "@mc/content";
import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../testing/driver.js";
import { WAVE1_ABILITIES } from "../wave1/index.js";
import { WAVE2_ABILITIES } from "../wave2/index.js";
import { WAVE3_ABILITIES } from "../wave3/index.js";
import { WAVE4_ABILITIES } from "../wave4/index.js";
import { PLAYABLE_ABILITIES, PLAYABLE_DEPS, playableScenario } from "./index.js";

describe("the playable pool is every wave, once", () => {
  test("no card id appears twice, and every wave's cards are present", () => {
    const ids = PLAYABLE_CARDS.map((card) => card.id as string);
    expect(new Set(ids).size).toBe(ids.length);
    const known = new Set(ids);
    for (const card of [...WAVE1_CARDS, ...WAVE2_CARDS, ...WAVE3_CARDS, ...WAVE4_CARDS])
      expect(known.has(card.id)).toBe(true);
  });

  test("every ability any wave scripts is registered, unchanged", () => {
    for (const registry of [WAVE1_ABILITIES, WAVE2_ABILITIES, WAVE3_ABILITIES, WAVE4_ABILITIES])
      for (const [id, ability] of Object.entries(registry)) expect(PLAYABLE_ABILITIES[id]).toBe(ability);
  });
});

describe("a modular set from a later box at an earlier box's scenario", () => {
  const deckOf = (config: ReturnType<typeof playableScenario>) => config.encounterDeck ?? [];
  const setCards = (setId: string) =>
    PLAYABLE_CARDS.filter(
      (card) =>
        "encounterSetIds" in card &&
        (card.encounterSetIds as readonly string[]).includes(setId) &&
        card.type !== "villain" &&
        card.type !== "main_scheme",
    ).flatMap((card) => Array.from({ length: card.quantityInSet }, () => card.id));
  const base = { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 5 } as const;

  test("Rhino with The Shadow King instead of Bomb Scare: its cards are in the deck, Bomb Scare's are not", () => {
    const withShadowKing = deckOf(playableScenario("rhino", { ...base, modularSetIds: ["shadow_king"] }));
    const printed = deckOf(playableScenario("rhino", base));
    const shadowKing = setCards("shadow_king");
    expect(shadowKing.length).toBeGreaterThan(0);
    for (const id of new Set(shadowKing)) expect(withShadowKing).toContain(id);
    const bombScare = new Set(setCards("bomb_scare"));
    expect(withShadowKing.some((id) => bombScare.has(id))).toBe(false);
    expect(withShadowKing.length).toBe(printed.length - setCards("bomb_scare").length + shadowKing.length);
  });

  test("a wave 1 and a cycle 1 scenario take a later box's set the same way", () => {
    // Crossbones asks for three modular sets, so the later box's set comes with two of Core's.
    const picks = { "risky-business": ["reavers"], crossbones: ["reavers", "bomb_scare", "under_attack"] };
    for (const scenarioId of ["risky-business", "crossbones"] as const) {
      const deck = deckOf(playableScenario(scenarioId, { ...base, modularSetIds: picks[scenarioId] }));
      for (const id of new Set(setCards("reavers"))) expect(deck, scenarioId).toContain(id);
    }
  });

  test("a set the scenario's own wave already knows still goes through its own builder, unchanged", () => {
    const viaPlayable = deckOf(playableScenario("rhino", { ...base, modularSetIds: ["under_attack"] }));
    expect(viaPlayable.length).toBe(deckOf(playableScenario("rhino", base)).length - 6 + 5);
  });
});

describe("a deck from one wave against a scenario from the other", () => {
  const cases: readonly [scenario: string, deck: string][] = [
    ["risky-business", WAVE2_STARTER_DECKS[0]!.id],
    ["crossbones", WAVE1_STARTER_DECKS[0]!.id],
    ["kang", WAVE1_STARTER_DECKS[1]!.id],
    ["rhino", WAVE2_STARTER_DECKS[1]!.id],
  ];

  test.each(cases)(
    "%s, solo: %s plays to an outcome and replays",
    (scenarioId, starterDeckId) => {
      const config = playableScenario(scenarioId, { players: [{ starterDeckId }], seed: 2026 });
      const created = createGame(config, PLAYABLE_DEPS);
      if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
      const result = playToOutcome(created.state, PLAYABLE_DEPS);
      expect(result.outcome).not.toBeNull();
      const replayed = replay(result.session.log, PLAYABLE_DEPS);
      expect(replayed.ok).toBe(true);
      if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
    },
    120_000,
  );

  test("a four-seat table mixing Core, wave 1 and cycle 1 decks sets up on Breakout", () => {
    const config = playableScenario("breakout", {
      players: [
        { starterDeckId: WAVE1_STARTER_DECKS[0]!.id },
        { starterDeckId: WAVE2_STARTER_DECKS[0]!.id },
        { starterDeckId: WAVE2_STARTER_DECKS[2]!.id },
      ],
      seed: 7,
    });
    expect(createGame(config, PLAYABLE_DEPS).ok).toBe(true);
  });

  test('"extreme" stays Breakout\'s own', () => {
    expect(() =>
      playableScenario("crossbones", {
        players: [{ starterDeckId: "qsv-protection" }],
        seed: 1,
        difficulty: "extreme",
      }),
    ).toThrow(/extreme/);
  });

  test("Groot (gmw) vs. a Core villain (Rhino) sets up", () => {
    const config = playableScenario("rhino", {
      players: [{ starterDeckId: WAVE3_STARTER_DECKS[0]!.id }],
      seed: 11,
    });
    expect(createGame(config, PLAYABLE_DEPS).ok).toBe(true);
  });

  test("Spider-Man (Core) vs. Nebula (gmw) sets up", () => {
    const config = playableScenario("nebula", {
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 12,
    });
    expect(createGame(config, PLAYABLE_DEPS).ok).toBe(true);
  });

  test("Spectrum (mts, wave 4) vs. a Core villain (Rhino) sets up", () => {
    const config = playableScenario("rhino", {
      players: [{ starterDeckId: WAVE4_STARTER_DECKS[0]!.id }],
      seed: 13,
    });
    expect(createGame(config, PLAYABLE_DEPS).ok).toBe(true);
  });

  test("Iron Man (Core) vs. Ebony Maw (mts, wave 4) sets up", () => {
    const config = playableScenario("ebony-maw", {
      players: [{ starterDeckId: "core-iron-man-aggression" }],
      seed: 14,
    });
    expect(createGame(config, PLAYABLE_DEPS).ok).toBe(true);
  });
});

describe("every wave 3 (gmw) scenario, every wave 3 precon", () => {
  const cases: readonly [scenario: string, deck: string][] = WAVE3_SCENARIOS.flatMap((scenario) =>
    WAVE3_STARTER_DECKS.map((deck): [string, string] => [scenario.id as string, deck.id as string]),
  );

  test.each(cases)(
    "%s builds with %s",
    (scenarioId, starterDeckId) => {
      const config = playableScenario(scenarioId, { players: [{ starterDeckId }], seed: 2026 });
      expect(createGame(config, PLAYABLE_DEPS).ok).toBe(true);
    },
    30_000,
  );
});

describe("every wave 4 (mts/The Hood) scenario, every wave 4 precon", () => {
  const cases: readonly [scenario: string, deck: string][] = WAVE4_SCENARIOS.flatMap((scenario) =>
    WAVE4_STARTER_DECKS.map((deck): [string, string] => [scenario.id as string, deck.id as string]),
  );

  test.each(cases)(
    "%s builds with %s",
    (scenarioId, starterDeckId) => {
      const config = playableScenario(scenarioId, { players: [{ starterDeckId }], seed: 2026 });
      expect(createGame(config, PLAYABLE_DEPS).ok).toBe(true);
    },
    30_000,
  );
});

describe("a wave 6 scenario keeps its set-aside modular picks (MojoMania's campaign layer owns them)", () => {
  test("Mojo's setAsideModularSetIds reach the builder rather than being stripped", () => {
    const config = playableScenario("mojo", {
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 2026,
      setAsideModularSetIds: ["sitcom", "western"],
    });
    expect((config.setAsideModularSets ?? []).map((set) => set.encounterSetId as string)).toEqual([
      "sitcom",
      "western",
    ]);
  });
});

describe("Longshot, an extra modular set, can be added to any scenario (MojoMania insert p. 2)", () => {
  const players = [{ starterDeckId: WAVE1_STARTER_DECKS[0]!.id }];
  const LONGSHOT = "39071";

  test.each(["rhino", "risky-business", "kang", "tower-defense", "mansion-attack"])(
    "%s: one Longshot joins the encounter deck, and nothing else changes",
    (scenarioId) => {
      const plain = playableScenario(scenarioId, { players, seed: 7 });
      const withLongshot = playableScenario(scenarioId, { players, seed: 7, extraModularSetIds: ["longshot"] });
      const before = plain.encounterDeck ?? [];
      const after = withLongshot.encounterDeck ?? [];
      expect(after).toHaveLength(before.length + 1);
      expect(after.filter((id) => (id as string) === LONGSHOT)).toHaveLength(1);
      expect(after.filter((id) => (id as string) !== LONGSHOT)).toEqual(before);
      const created = createGame(withLongshot, PLAYABLE_DEPS);
      expect(created.ok).toBe(true);
    },
  );

  test("only an extra modular set is accepted, once", () => {
    expect(() => playableScenario("rhino", { players, seed: 1, extraModularSetIds: ["crime"] })).toThrow(
      "not an extra modular set",
    );
    expect(() => playableScenario("rhino", { players, seed: 1, extraModularSetIds: ["longshot", "longshot"] })).toThrow(
      "added twice",
    );
  });
});
