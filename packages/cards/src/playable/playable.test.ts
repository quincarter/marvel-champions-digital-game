import { PLAYABLE_CARDS, WAVE1_CARDS, WAVE1_STARTER_DECKS, WAVE2_CARDS, WAVE2_STARTER_DECKS } from "@mc/content";
import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../testing/driver.js";
import { WAVE1_ABILITIES } from "../wave1/index.js";
import { WAVE2_ABILITIES } from "../wave2/index.js";
import { PLAYABLE_ABILITIES, PLAYABLE_DEPS, playableScenario } from "./index.js";

describe("the playable pool is both waves, once", () => {
  test("no card id appears twice, and every wave's cards are present", () => {
    const ids = PLAYABLE_CARDS.map((card) => card.id as string);
    expect(new Set(ids).size).toBe(ids.length);
    const known = new Set(ids);
    for (const card of [...WAVE1_CARDS, ...WAVE2_CARDS]) expect(known.has(card.id)).toBe(true);
  });

  test("every ability either wave scripts is registered, unchanged", () => {
    for (const registry of [WAVE1_ABILITIES, WAVE2_ABILITIES])
      for (const [id, ability] of Object.entries(registry)) expect(PLAYABLE_ABILITIES[id]).toBe(ability);
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
});
