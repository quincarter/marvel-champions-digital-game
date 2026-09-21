import { CORE_STARTER_DECKS, campaignId, cardId, type HeroIdentityCard, type PlayModes } from "@mc/content";
import { createGame } from "@mc/engine";
import { CORE_DEPS } from "./index.js";
import { coreScenario, resolveModes, type CoreScenarioOptions } from "./setup.js";

/**
 * RRG "Unique": "The players as a group are permitted to have only one copy of each unique
 * card (by title) in play." The identity card is included in that evaluation, so a table
 * cannot seat the same hero twice — not even from two different starter decks.
 */
const identityOf = (starterDeckId: string): string => {
  const deck = CORE_STARTER_DECKS.find((d) => d.id === starterDeckId);
  if (!deck) throw new Error(`no Core starter deck ${starterDeckId}`);
  return deck.identityCardId;
};

const setUp = (starterDeckIds: readonly string[]) =>
  createGame(
    coreScenario("rhino", { players: starterDeckIds.map((starterDeckId) => ({ starterDeckId })), seed: 99 }),
    CORE_DEPS,
  );

test("two seats on the same Core starter deck are rejected", () => {
  const result = setUp(["core-captain-marvel-leadership", "core-captain-marvel-leadership"]);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe("duplicate_unique_card");
    expect(result.error.message).toContain("Captain Marvel (Carol Danvers)");
  }
});

test("two *different* Captain Marvel starter decks are still the same hero, and rejected", () => {
  // Same identity card (01010a) reached by two different decklists — the case a player hit.
  const leadership = "core-captain-marvel-leadership";
  const aggression = "core-captain-marvel-aggression-tutorial";
  expect(identityOf(leadership)).toBe(identityOf(aggression));
  const result = setUp([leadership, aggression]);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe("duplicate_unique_card");
    expect(result.error.message).toContain("Captain Marvel (Carol Danvers)");
  }
});

test("a four-hero table of distinct heroes is still accepted", () => {
  const result = setUp([
    "core-captain-marvel-leadership",
    "core-iron-man-aggression",
    "core-black-panther-protection",
    "core-spider-man-justice",
  ]);
  expect(result.ok).toBe(true);
});

/** Proves the exception is wired to the alter-ego, not the card id, using real Core data. */
test("a re-titled alter-ego of the same hero may share the table", () => {
  const base = coreScenario("rhino", { players: [{ starterDeckId: "core-captain-marvel-leadership" }], seed: 99 });
  const captainMarvel = base.cards.find((card) => card.id === "01010a");
  if (!captainMarvel || captainMarvel.type !== "hero_identity") throw new Error("no Captain Marvel in the Core pool");
  const otherCarol: HeroIdentityCard = {
    ...captainMarvel,
    id: cardId("01010a-alt"),
    alterEgo: { ...captainMarvel.alterEgo, faceName: "Monica Rambeau" },
  };
  const seat = base.players[0];
  if (!seat) throw new Error("no seat");
  const result = createGame(
    {
      ...base,
      // Deliberately not a legal deck: the second seat reuses Captain Marvel's signature cards
      // under a synthetic identity. This test is about the setup half of the unique rule only.
      requireLegalDecks: false,
      cards: [...base.cards, otherCarol],
      players: [seat, { identityCardId: otherCarol.id, deck: seat.deck }],
    },
    CORE_DEPS,
  );
  expect(result.ok).toBe(true);
});

/**
 * `CorePlayer.deckId` (docs/phase4-screen-gaps.md §2 S4): a client-only attribution id, never a
 * rules input. `coreScenario` maps a custom seat's fields by name into `PlayerSetup`
 * (`identityCardId`, `deck`, `aspects`), so `deckId` never reaches it — these prove that directly,
 * rather than trusting the doc comment alone.
 */
describe("CorePlayer.deckId never reaches the engine", () => {
  const spiderMan = CORE_STARTER_DECKS.find((d) => d.id === "core-spider-man-justice")!;
  const deckList = spiderMan.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId));
  const seatWithout = { identityCardId: spiderMan.identityCardId, deck: deckList, aspects: spiderMan.aspects };
  const seatWith = { ...seatWithout, deckId: "local-deck-42" };

  test("coreScenario's GameSetupConfig is byte-identical whether the seat carries a deckId or not", () => {
    const withoutId = coreScenario("rhino", { players: [seatWithout], seed: 99 });
    const withId = coreScenario("rhino", { players: [seatWith], seed: 99 });
    expect(withId).toEqual(withoutId);
  });

  test("createGame's resulting state and events are byte-identical whether the seat carries a deckId or not", () => {
    const withoutId = createGame(coreScenario("rhino", { players: [seatWithout], seed: 99 }), CORE_DEPS);
    const withId = createGame(coreScenario("rhino", { players: [seatWith], seed: 99 }), CORE_DEPS);
    expect(withoutId.ok).toBe(true);
    expect(withId.ok).toBe(true);
    if (!withoutId.ok || !withId.ok) return;
    expect(withId.state).toEqual(withoutId.state);
    expect(withId.events).toEqual(withoutId.events);
  });
});

/**
 * `resolveModes` is the single reconciliation between the old `difficulty` option and the RRG 1.8 mode set
 * (`@mc/content`'s `schema/modes.ts`, pp. 28–29). It has to be additive in both directions: a caller that says
 * nothing gets standard mode, a caller that says `difficulty` gets exactly what it always got, and a caller
 * that says `modes` gets the same setup as the equivalent `difficulty`.
 */
describe("resolveModes", () => {
  const TRORS = campaignId("trors");

  test("neither option given is standard mode", () => {
    expect(resolveModes(undefined, undefined)).toEqual({});
  });

  test("a bare difficulty projects to the mode set it means", () => {
    expect(resolveModes("standard", undefined)).toEqual({});
    expect(resolveModes("expert", undefined)).toEqual({ expert: true });
  });

  test('wave 1\'s "extreme" is not a mode: it resolves to standard and is read off `difficulty` by its own builder', () => {
    expect(resolveModes("extreme", undefined)).toEqual({});
  });

  test("modes wins when both are given and they agree", () => {
    const modes: PlayModes = { expert: true, campaign: { campaignId: TRORS, expertCampaign: true } };
    expect(resolveModes("expert", modes)).toBe(modes);
    expect(resolveModes("standard", { campaign: { campaignId: TRORS } })).toEqual({ campaign: { campaignId: TRORS } });
  });

  test("campaign mode alongside a standard difficulty is not a disagreement — it's the orthogonal axis", () => {
    expect(() => resolveModes("standard", { campaign: { campaignId: TRORS, expertCampaign: true } })).not.toThrow();
  });

  test("a difficulty and modes that disagree about expert mode throw rather than one silently winning", () => {
    expect(() => resolveModes("standard", { expert: true })).toThrow(/disagree about expert mode/);
    expect(() => resolveModes("expert", {})).toThrow(/disagree about expert mode/);
    expect(() => resolveModes("extreme", { expert: true })).toThrow(/disagree about expert mode/);
  });
});

describe("coreScenario and the mode set", () => {
  const players = [{ starterDeckId: "core-spider-man-justice" }];
  const scenario = (extra: Omit<Partial<CoreScenarioOptions>, "players" | "seed">) =>
    coreScenario("rhino", { players, seed: 99, ...extra });

  test("modes: { expert: true } builds byte-identically to difficulty: 'expert'", () => {
    expect(scenario({ modes: { expert: true } })).toEqual(scenario({ difficulty: "expert" }));
  });

  test("an empty mode set builds byte-identically to the default, and to difficulty: 'standard'", () => {
    expect(scenario({ modes: {} })).toEqual(scenario({}));
    expect(scenario({ difficulty: "standard" })).toEqual(scenario({}));
  });

  /** Expert mode is the only axis anything consumes yet; campaign must reach the engine as nothing at all. */
  test("campaign mode is carried but changes no part of the setup config", () => {
    const campaign = { campaignId: campaignId("trors"), expertCampaign: true } as const;
    expect(scenario({ modes: { campaign } })).toEqual(scenario({}));
    expect(scenario({ modes: { expert: true, campaign } })).toEqual(scenario({ difficulty: "expert" }));
  });

  test("the disagreement throw reaches the builder's callers", () => {
    expect(() => scenario({ difficulty: "expert", modes: {} })).toThrow(/disagree about expert mode/);
  });
});
