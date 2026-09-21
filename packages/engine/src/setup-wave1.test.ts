/**
 * docs/phase7-wave1.md §3.15: setup — scenario overrides, the per-villain version choice, one encounter deck per
 * villain, the step 12a/12c ordering, player setup abilities at step 16, and any number of modular sets including 0.
 *
 * Source: RRG 1.8 Appendix II "Setup" (p. 51); The Wrecking Crew insert, "Adjustable Difficulty" and "Prepare
 * Encounter Decks"; FAQ "Steve Rogers (#1B)" (p. 59).
 */

import { encounterSetId, flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { GameEvent } from "./events.js";
import { playerId } from "./ids.js";
import { characterProfile, encounterDeckOf, mustInstance, mustPlayer } from "./query.js";
import { createGame, type GameSetupConfig, type SetupResult } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import {
  stubIdentity,
  stubMainScheme,
  stubMinion,
  stubObligation,
  stubSideScheme,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, resolvePending } from "./testing/scenario.js";

const p1 = playerId("p1");
const one = { kind: "const", value: 1 } as const;
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const MODULAR_A = stubTreachery({ id: "modular-a", boostIcons: 0 });
const MODULAR_B = stubTreachery({ id: "modular-b", boostIcons: 0 });
const SIGNATURE = stubSideScheme({ id: "signature", startingThreat: 1, boostIcons: 0 });

/** Two printed versions of one villain: A is the first stage, B the second (The Wrecking Crew insert). */
const versioned = (id: string) =>
  stubVillain({
    id,
    stages: [
      { hp: flat(10), atk: 1, sch: 1 },
      { hp: flat(20), atk: 2, sch: 2 },
    ],
  });
const WRECKER = versioned("wrecker");
const THUNDERBALL = versioned("thunderball");
const ONE_STAGE = stubVillain({ id: "one-stage", stages: [{ hp: flat(10), atk: 1, sch: 1 }] });

// --- setup-ability order (step 12a, 12b, 12c, then step 16) ------------------------------------------------------

const marker = (id: string, counterType: string): StubAbility =>
  stubAbility(id, {
    trigger: { kind: id.endsWith("setup") ? "setup" : "whenRevealed" },
    effects: [{ kind: "addCounters", target: { kind: "mainScheme" }, counterType, amount: one }],
  });
const SCHEME_1A_SETUP = marker("scheme.a-setup", "a");
const SCHEME_1B_REVEALED = marker("scheme.b-revealed", "b");
const WRECKER_SETUP = marker("wrecker.setup", "v1s");
const WRECKER_REVEALED = marker("wrecker.revealed", "v1w");
const THUNDERBALL_SETUP = marker("thunderball.setup", "v2s");
const THUNDERBALL_REVEALED = marker("thunderball.revealed", "v2w");
const IDENTITY_SETUP = marker("identity.setup", "id");

const ORDERED_SCHEME = stubMainScheme({
  id: "ordered-scheme",
  stages: [
    {
      startingThreat: flat(0),
      targetThreat: flat(99),
      acceleration: flat(0),
      aSideAbilities: [SCHEME_1A_SETUP.ref],
      abilities: [SCHEME_1B_REVEALED.ref],
    },
  ],
});
const ORDERED_WRECKER = stubVillain({
  id: "ordered-wrecker",
  stages: [{ hp: flat(10), atk: 0, sch: 0, abilities: [WRECKER_SETUP.ref, WRECKER_REVEALED.ref] }],
});
const ORDERED_THUNDERBALL = stubVillain({
  id: "ordered-thunderball",
  stages: [{ hp: flat(10), atk: 0, sch: 0, abilities: [THUNDERBALL_SETUP.ref, THUNDERBALL_REVEALED.ref] }],
});
const SETUP_IDENTITY = stubIdentity({
  id: "setup-hero",
  hp: 10,
  atk: 2,
  thw: 2,
  def: 2,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 6,
  alterEgoAbilities: [IDENTITY_SETUP.ref],
});

// --- identity sets (steps 4, 5 and 10) ---------------------------------------------------------------------------

const NEMESIS_SET = "hero-nemesis";
const OBLIGATION = stubObligation({ id: "hero-obligation" });
const NEMESIS_MINION = stubMinion({
  id: "nemesis-minion",
  encounterSetIds: [NEMESIS_SET],
  atk: 1,
  sch: 1,
  hp: 3,
  boostIcons: 0,
});
const SET_HERO = stubIdentity({
  id: "set-hero",
  hp: 10,
  atk: 2,
  thw: 2,
  def: 2,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 6,
});
const SET_HERO_WITH_SET = {
  ...SET_HERO,
  obligationCardId: OBLIGATION.id,
  nemesisEncounterSetId: encounterSetId(NEMESIS_SET),
};

const PLAIN_SCHEME = stubMainScheme({
  id: "plain-scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});

const deps: EngineDeps = depsOf(
  SCHEME_1A_SETUP,
  SCHEME_1B_REVEALED,
  WRECKER_SETUP,
  WRECKER_REVEALED,
  THUNDERBALL_SETUP,
  THUNDERBALL_REVEALED,
  IDENTITY_SETUP,
);

const CARDS = [
  ...DEFAULT_CARDS,
  WRECKER,
  THUNDERBALL,
  ONE_STAGE,
  ORDERED_WRECKER,
  ORDERED_THUNDERBALL,
  ORDERED_SCHEME,
  PLAIN_SCHEME,
  BLANK,
  MODULAR_A,
  MODULAR_B,
  SIGNATURE,
  OBLIGATION,
  NEMESIS_MINION,
  SETUP_IDENTITY,
  SET_HERO_WITH_SET,
];

function build(
  config: Partial<GameSetupConfig> & Pick<GameSetupConfig, "villainCardId" | "mainSchemeCardId">,
): SetupResult {
  return createGame(
    {
      seed: 8,
      cards: CARDS,
      encounterDeck: copies(BLANK.id, 12),
      includeIdentitySets: false,
      players: [{ identityCardId: HERO.id, deck: DEFAULT_DECK }],
      ...config,
    },
    deps,
  );
}

const mustBuild = (config: Parameters<typeof build>[0]): GameState => {
  const result = build(config);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
};

const counterOrder = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((event) => (event.type === "counterAdded" ? [event.counterType] : []));

describe("§3.15 steps 8–9: the per-villain version choice", () => {
  it.each([
    { version: "A" as const, stageIndex: 0, lastStageIndex: 0, atk: 1 },
    { version: "B" as const, stageIndex: 1, lastStageIndex: 1, atk: 2 },
    { version: "extreme" as const, stageIndex: 0, lastStageIndex: 1, atk: 1 },
  ])(
    "version $version starts at stage $stageIndex and ends at stage $lastStageIndex",
    ({ version, stageIndex, lastStageIndex, atk }) => {
      const state = mustBuild({
        villainCardId: WRECKER.id,
        mainSchemeCardId: PLAIN_SCHEME.id,
        encounterDeck: [],
        villains: [{ villainCardId: WRECKER.id, encounterDeck: copies(BLANK.id, 6), version }],
      });
      expect(state.villains[0]).toMatchObject({ stageIndex, lastStageIndex });
      expect(characterProfile(state, state.villains[0]!.instanceId, deps)?.atk).toBe(atk);
    },
  );

  it("each villain chooses its own version, so a mixed table is legal", () => {
    const state = mustBuild({
      villainCardId: WRECKER.id,
      mainSchemeCardId: PLAIN_SCHEME.id,
      encounterDeck: [],
      villains: [
        { villainCardId: WRECKER.id, encounterDeck: copies(BLANK.id, 6), version: "A" },
        { villainCardId: THUNDERBALL.id, encounterDeck: copies(BLANK.id, 6), version: "extreme" },
      ],
    });
    expect(state.villains.map((villain) => [villain.stageIndex, villain.lastStageIndex])).toEqual([
      [0, 0],
      [0, 1],
    ]);
  });

  it("a version alongside explicit stage indexes is refused, and so is a version the villain does not have", () => {
    const both = build({
      villainCardId: WRECKER.id,
      mainSchemeCardId: PLAIN_SCHEME.id,
      encounterDeck: [],
      villains: [{ villainCardId: WRECKER.id, encounterDeck: [], version: "A", startStageIndex: 1 }],
    });
    expect(both.ok).toBe(false);
    if (!both.ok) expect(both.error.code).toBe("invalid_setup");

    const missing = build({
      villainCardId: ONE_STAGE.id,
      mainSchemeCardId: PLAIN_SCHEME.id,
      encounterDeck: [],
      villains: [{ villainCardId: ONE_STAGE.id, encounterDeck: [], version: "B" }],
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.message).toContain("stage index 1");
  });
});

describe("§3.15 steps 4–5 and 10: identity sets and encounter decks", () => {
  it("skipping the identity encounter sets leaves the obligation and nemesis set out of the game", () => {
    const without = mustBuild({
      villainCardId: WRECKER.id,
      mainSchemeCardId: PLAIN_SCHEME.id,
      players: [{ identityCardId: SET_HERO_WITH_SET.id, deck: DEFAULT_DECK }],
    });
    const deck = encounterDeckOf(without, without.encounterDeckOrder[0]!).deck;
    expect(deck.every((id) => mustInstance(without, id).cardId === BLANK.id)).toBe(true);
    expect(mustPlayer(without, p1).setAside).toEqual([]);

    // With them, step 10 shuffles the obligation in and step 5 sets the nemesis set aside.
    const with_ = mustBuild({
      villainCardId: WRECKER.id,
      mainSchemeCardId: PLAIN_SCHEME.id,
      includeIdentitySets: true,
      players: [{ identityCardId: SET_HERO_WITH_SET.id, deck: DEFAULT_DECK }],
    });
    const withDeck = encounterDeckOf(with_, with_.encounterDeckOrder[0]!).deck;
    expect(withDeck.filter((id) => mustInstance(with_, id).cardId === OBLIGATION.id)).toHaveLength(1);
    expect(mustPlayer(with_, p1).setAside.map((id) => mustInstance(with_, id).cardId)).toEqual([NEMESIS_MINION.id]);
  });

  it("each villain gets its own encounter deck, and every card in it knows that deck is its home", () => {
    const state = mustBuild({
      villainCardId: WRECKER.id,
      mainSchemeCardId: PLAIN_SCHEME.id,
      encounterDeck: [],
      villains: [
        { villainCardId: WRECKER.id, encounterDeck: copies(BLANK.id, 5), signatureSideSchemeCardId: SIGNATURE.id },
        { villainCardId: THUNDERBALL.id, encounterDeck: copies(MODULAR_A.id, 7) },
      ],
    });
    expect(state.encounterDeckOrder).toHaveLength(2);
    for (const villain of state.villains) {
      const piles = encounterDeckOf(state, villain.encounterDeckId);
      expect(piles.deck.every((id) => mustInstance(state, id).home).valueOf()).toBe(true);
      for (const id of piles.deck)
        expect(mustInstance(state, id).home).toEqual({ kind: "encounterDeck", deckId: villain.encounterDeckId });
    }
    // The signature side scheme is set aside, and is its villain's, not a deck card.
    expect(state.encounterSetAside).toEqual([state.villains[0]?.signatureSideSchemeId]);
  });

  it("any number of modular sets is accepted, including none", () => {
    const none = mustBuild({
      villainCardId: WRECKER.id,
      mainSchemeCardId: PLAIN_SCHEME.id,
      encounterDeck: copies(BLANK.id, 10),
    });
    expect(encounterDeckOf(none, none.encounterDeckOrder[0]!).deck).toHaveLength(10);

    const several = mustBuild({
      villainCardId: WRECKER.id,
      mainSchemeCardId: PLAIN_SCHEME.id,
      encounterDeck: [...copies(BLANK.id, 10), ...copies(MODULAR_A.id, 4), ...copies(MODULAR_B.id, 4)],
    });
    expect(encounterDeckOf(several, several.encounterDeckOrder[0]!).deck).toHaveLength(18);
  });
});

describe("§3.15 step 12 and step 16: the order setup abilities resolve in", () => {
  it("1A setup, then 1B when revealed, then each villain in printed order, and player setup abilities last", () => {
    const result = build({
      villainCardId: ORDERED_WRECKER.id,
      mainSchemeCardId: ORDERED_SCHEME.id,
      encounterDeck: [],
      villains: [
        { villainCardId: ORDERED_WRECKER.id, encounterDeck: copies(BLANK.id, 6) },
        { villainCardId: ORDERED_THUNDERBALL.id, encounterDeck: copies(BLANK.id, 6) },
      ],
      players: [{ identityCardId: SETUP_IDENTITY.id, deck: DEFAULT_DECK }],
    });
    if (!result.ok) throw new Error(result.error.message);

    // Steps 12a to 12c happen before the draw; the player's own "Setup:" ability is step 16 and has not run yet.
    expect(counterOrder(result.events)).toEqual(["a", "b", "v1s", "v1w", "v2s", "v2w"]);
    expect(result.state.pendingChoice?.prompt.kind).toBe("mulligan");

    const afterMulligan = resolvePending(result.state, [], deps);
    const scheme = afterMulligan.mainScheme.instanceId;
    expect(mustInstance(afterMulligan, scheme).counters.id).toBe(1);
    // Every setup ability has now resolved exactly once, and the first round has begun.
    expect(mustInstance(afterMulligan, scheme).counters).toEqual({ a: 1, b: 1, v1s: 1, v1w: 1, v2s: 1, v2w: 1, id: 1 });
    expect(afterMulligan.step).toEqual({ phase: "player", kind: "turn", activePlayerId: p1, remainingPlayerIds: [] });
  });
});
