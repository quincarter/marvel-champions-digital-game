/**
 * Two campaign primitives closed while finishing MC32's `CampaignDefinition` (`@mc/cards` `src/campaigns/mut_gen.ts`):
 *
 * - `CampaignGameQuery` `cardsInEncounterDeckAndDiscard` (MC32 pp. 7/10/12/16: "Add each Future Past card found in the
 *   encounter deck, discard pile, and in play to the campaign log"), with `LogWriteSpec.distinct`, so a card the field
 *   already names is not appended a second time.
 * - `CollectionFilter.notInOwnDeck` (MC32 p. 5, role-building: "If a player's deck does not already include their
 *   chosen event and/or upgrade, they may add either or both").
 */
import { describe, expect, it } from "vitest";
import { CORE_CARDS, campaignId, cardId, scenarioId, type AnyCard, type PlayModes, type PlayerCard } from "@mc/content";
import { DEFAULT_DEPS } from "../abilities.js";
import type { CampaignDefinition, CampaignGameResult, CampaignLog, LogWriteSpec } from "../campaign.js";
import type { GameEvent } from "../events.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { stubTreachery } from "../testing/fixtures.js";
import { DEFAULT_CARDS, HERO, MAIN_SCHEME, VILLAIN, seatIdentities } from "../testing/scenario.js";
import { createGame, type GameSetupConfig } from "../setup.js";
import type { GameState } from "../state.js";
import { campaignResultOf } from "./result.js";
import { applyCampaignResult, createCampaignLog, resolveBetweenGames, type CampaignSeatSetup } from "./runner.js";

const CAMPAIGN_ID = campaignId("encounter-and-own-deck-test");
const MODES: PlayModes = { campaign: { campaignId: CAMPAIGN_ID } };

function definitionWith(
  setup: CampaignDefinition["graph"]["nodes"][number]["setup"],
  victory: CampaignDefinition["graph"]["nodes"][number]["victory"] = [],
): CampaignDefinition {
  return {
    campaignId: CAMPAIGN_ID,
    version: "1",
    logFields: [
      { id: "found", label: "Found", scope: "shared", type: { kind: "cardList" }, citation: "test" },
      { id: "every", label: "Every", scope: "shared", type: { kind: "cardList" }, citation: "test" },
    ],
    loss: { retry: "free", retryBaseline: "nodeStart" },
    graph: {
      kind: "linear",
      nodes: [
        {
          id: "only",
          label: "Only",
          scenario: { kind: "fixed", scenarioId: scenarioId("encounter-and-own-deck-scenario") },
          setup,
          victory,
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// cardsInEncounterDeckAndDiscard + distinct
// ---------------------------------------------------------------------------------------------------------------

const FP = ["fp-1", "fp-2", "fp-3", "fp-4", "fp-5"].map((id) => stubTreachery({ id, encounterSetIds: ["fp"] }));
const OTHER = stubTreachery({ id: "other", encounterSetIds: ["standard"] });
const FP_QUERY = { inEncounterSet: "fp" } as const;

const SEATS: readonly CampaignSeatSetup[] = [
  {
    seatNumber: 1,
    identityCardId: cardId("hero-one"),
    deck: { identityCardId: cardId("hero-one"), aspects: [], cards: [] },
  },
];

/**
 * A finished game with Future Past cards everywhere the query should and should not look: fp-1 in the encounter deck,
 * fp-2 in the encounter discard pile, fp-3 in play (the villain area), fp-4 in the set-aside "Future Past" scenario
 * deck, fp-5 in the victory display, and a non-Future Past card in the encounter deck. Built the same way each call,
 * so two calls are two replays of one game.
 */
function finishedGame(): GameState {
  const identities = seatIdentities(HERO, 1);
  const config: GameSetupConfig = {
    seed: 7,
    cards: [...DEFAULT_CARDS, ...identities, ...FP, OTHER],
    villainCardId: VILLAIN.id,
    mainSchemeCardId: MAIN_SCHEME.id,
    encounterDeck: [...FP.map((card) => card.id), OTHER.id],
    players: identities.map((identity) => ({ identityCardId: identity.id, deck: [] })),
  };
  const created = createGame(config, DEFAULT_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const state = created.state;
  const deckId = state.encounterDeckOrder[0]!;
  const piles = state.encounterDecks[deckId]!;
  const all = [...piles.deck, ...piles.discard];
  const of = (id: string): InstanceId => {
    const found = all.find((instance) => state.instances[instance]?.cardId === id);
    if (!found) throw new Error(`no ${id} in the encounter deck`);
    return found;
  };
  return {
    ...state,
    encounterDecks: { ...state.encounterDecks, [deckId]: { deck: [of("other"), of("fp-1")], discard: [of("fp-2")] } },
    villainArea: [...state.villainArea, of("fp-3")],
    scenarioDecks: {
      "Future Past": {
        deck: [of("fp-4")],
        discard: [],
        discardPile: "encounter",
        whenEmpty: "remainsEmpty",
        contents: { encounterSetIds: ["fp"] },
      },
    },
    victoryDisplay: [...state.victoryDisplay, of("fp-5")],
    outcome: { result: "win", reason: "villainDefeated" },
  };
}

const record = (writes: readonly LogWriteSpec[]): CampaignDefinition =>
  definitionWith([], [{ id: "only.victory.found", text: "test", citation: "test", step: { kind: "record", writes } }]);

function composedLog(definition: CampaignDefinition): CampaignLog {
  const composed = resolveBetweenGames(
    definition,
    createCampaignLog(definition, { id: "run", seats: SEATS, modes: MODES, poolVersion: "test", seed: 1 }),
    { pool: [] },
    MODES,
  );
  if (composed.kind !== "done") throw new Error("unexpected pending choice");
  return composed.value;
}

const resultFor = (definition: CampaignDefinition, log: CampaignLog, state: GameState): CampaignGameResult =>
  campaignResultOf(definition, log, state, [], DEFAULT_DEPS);

function fold(definition: CampaignDefinition, log: CampaignLog, result: CampaignGameResult): CampaignLog {
  const applied = applyCampaignResult(definition, log, result, { at: 1 }, { pool: [] });
  if (applied.kind !== "done") throw new Error("unexpected pending choice");
  return applied.value;
}

describe("CampaignGameQuery.cardsInEncounterDeckAndDiscard (MC32 pp. 7/10/12/16)", () => {
  it("reads every encounter deck and discard pile, then in play; never a scenario deck unless named, nor the victory display", () => {
    const definition = record([
      {
        field: "found",
        mode: "append",
        value: { kind: "cardsInEncounterDeckAndDiscard", query: FP_QUERY, inPlay: true },
      },
      {
        field: "every",
        mode: "append",
        value: { kind: "cardsInEncounterDeckAndDiscard", query: FP_QUERY, scenarioDecks: ["Future Past", "absent"] },
      },
    ]);
    const log = composedLog(definition);
    const result = resultFor(definition, log, finishedGame());
    const [found, every] = result.records.map((entry) => entry.write.value);
    expect(found).toEqual({ kind: "cardList", cardIds: ["fp-1", "fp-2", "fp-3"] });
    // Without `inPlay` the card in play is not read; a named scenario deck is (an unknown name reads nothing).
    expect(every).toEqual({ kind: "cardList", cardIds: ["fp-1", "fp-2", "fp-4"] });
  });

  it("is a derived reducer: two replays of one finished game give deep-equal results and folded logs", () => {
    const definition = record([
      {
        field: "found",
        mode: "append",
        distinct: true,
        value: { kind: "cardsInEncounterDeckAndDiscard", query: FP_QUERY, inPlay: true },
      },
    ]);
    const log = composedLog(definition);
    const first = resultFor(definition, log, finishedGame());
    const second = resultFor(definition, log, finishedGame());
    expect(second).toEqual(first);
    expect(first.records[0]?.write.distinct).toBe(true);
    expect(fold(definition, log, second)).toEqual(fold(definition, log, first));
  });
});

describe("CampaignGameQuery.cardsThatEnteredPlay (MC10 p. 5)", () => {
  // fp-3 entered play, left, and entered again: one physical card, two entries in the event stream.
  const state = finishedGame();
  const fp3 = state.villainArea.find((id) => state.instances[id]?.cardId === "fp-3")!;
  const entered: GameEvent = {
    type: "triggerEvent",
    phase: "resolved",
    event: { kind: "cardEntersPlay", instanceId: fp3, playerId: null },
  };
  const recordedWith = (distinct: boolean) => {
    const definition = record([
      {
        field: "found",
        mode: "append",
        value: { kind: "cardsThatEnteredPlay", query: FP_QUERY, ...(distinct ? { distinct: true as const } : {}) },
      },
    ]);
    const result = campaignResultOf(definition, composedLog(definition), state, [entered, entered], DEFAULT_DEPS);
    return result.records[0]?.write.value;
  };

  it("keeps every entry by default (a card that entered play twice is listed twice)", () => {
    expect(recordedWith(false)).toEqual({ kind: "cardList", cardIds: ["fp-3", "fp-3"] });
  });

  it("with `distinct`, lists each card once however often it entered play", () => {
    expect(recordedWith(true)).toEqual({ kind: "cardList", cardIds: ["fp-3"] });
  });

  // Issue #1012: MC10 p. 10's rescued allies go into hand when Captured by Hydra is defeated, and one never played is
  // still rescued. A draw from the deck is not.
  it("with `orTakenIntoHand`, a card moved into a hand from anywhere but a deck counts too", () => {
    const fp2 = state.encounterDecks[state.encounterDeckOrder[0]!]!.discard[0]!;
    const fp1 = state.encounterDecks[state.encounterDeckOrder[0]!]!.deck[1]!;
    const player = state.players[0]!.playerId;
    const taken: GameEvent = {
      type: "cardMoved",
      instanceId: fp2,
      cardId: cardId("fp-2"),
      from: { kind: "tucked", hostInstanceId: fp3 },
      to: { kind: "hand", playerId: player },
    } as GameEvent;
    const drawn: GameEvent = {
      type: "cardMoved",
      instanceId: fp1,
      cardId: cardId("fp-1"),
      from: { kind: "deck", playerId: player },
      to: { kind: "hand", playerId: player },
    } as GameEvent;
    const definition = record([
      {
        field: "found",
        mode: "append",
        value: { kind: "cardsThatEnteredPlay", query: FP_QUERY, distinct: true, orTakenIntoHand: true },
      },
    ]);
    const result = campaignResultOf(definition, composedLog(definition), state, [taken, entered, drawn], DEFAULT_DEPS);
    expect(result.records[0]?.write.value).toEqual({ kind: "cardList", cardIds: ["fp-2", "fp-3"] });
  });

  // MC10 p. 10: "Each player who rescued one or more allies": the rescue is the move into that player's hand. An ally
  // one player rescued and discarded, and the other then played, is still the first player's rescue; the second
  // player, who only played it, rescued nothing.
  it("with `orTakenIntoHand`, a card is credited to the player whose hand it was taken into, not its final controller", () => {
    const identities = seatIdentities(HERO, 2);
    const created = createGame(
      {
        seed: 7,
        cards: [...DEFAULT_CARDS, ...identities, ...FP, OTHER],
        villainCardId: VILLAIN.id,
        mainSchemeCardId: MAIN_SCHEME.id,
        encounterDeck: [...FP.map((card) => card.id), OTHER.id],
        players: identities.map((identity) => ({ identityCardId: identity.id, deck: [] })),
      },
      DEFAULT_DEPS,
    );
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const base = created.state;
    const deckId = base.encounterDeckOrder[0]!;
    const piles = base.encounterDecks[deckId]!;
    const all = [...piles.deck, ...piles.discard];
    const of = (id: string): InstanceId => all.find((instance) => base.instances[instance]?.cardId === id)!;
    const [one, two] = base.players.map((player) => player.playerId) as [PlayerId, PlayerId];
    const fp2 = of("fp-2");
    const fp3 = of("fp-3");
    // fp-2 ends the game in the second player's play area (they played it); fp-3 entered play under the second player
    // without ever being in a hand.
    const finished: GameState = {
      ...base,
      outcome: { result: "win", reason: "villainDefeated" },
      // Only the seat numbers are read, to pair each seat with its player.
      campaign: { seats: [{ seatNumber: 1 }, { seatNumber: 2 }] } as unknown as NonNullable<GameState["campaign"]>,
      players: base.players.map((player) => (player.playerId === two ? { ...player, playArea: [fp2, fp3] } : player)),
      instances: {
        ...base.instances,
        [fp2]: { ...base.instances[fp2]!, controllerId: two },
        [fp3]: { ...base.instances[fp3]!, controllerId: two },
      },
    };
    const events: GameEvent[] = [
      {
        type: "cardMoved",
        instanceId: fp2,
        cardId: cardId("fp-2"),
        from: { kind: "tucked", hostInstanceId: fp3 },
        to: { kind: "hand", playerId: one },
      } as GameEvent,
      { type: "triggerEvent", phase: "resolved", event: { kind: "cardEntersPlay", instanceId: fp2, playerId: two } },
      { type: "triggerEvent", phase: "resolved", event: { kind: "cardEntersPlay", instanceId: fp3, playerId: two } },
    ];
    const definition: CampaignDefinition = {
      ...definitionWith(
        [],
        [
          {
            id: "only.victory.rescued",
            text: "test",
            citation: "test",
            step: {
              kind: "record",
              writes: [
                {
                  field: "rescued",
                  seat: "each",
                  mode: "append",
                  value: {
                    kind: "cardsThatEnteredPlay",
                    query: { ...FP_QUERY, controller: "you" },
                    distinct: true,
                    orTakenIntoHand: true,
                  },
                },
              ],
            },
          },
        ],
      ),
      logFields: [{ id: "rescued", label: "Rescued", scope: "perSeat", type: { kind: "cardList" }, citation: "test" }],
    };
    const seats: readonly CampaignSeatSetup[] = [1, 2].map((seatNumber) => ({
      seatNumber,
      identityCardId: identities[seatNumber - 1]!.id,
      deck: { identityCardId: identities[seatNumber - 1]!.id, aspects: [], cards: [] },
    }));
    const composed = resolveBetweenGames(
      definition,
      createCampaignLog(definition, { id: "run", seats, modes: MODES, poolVersion: "test", seed: 1 }),
      { pool: [] },
      MODES,
    );
    if (composed.kind !== "done") throw new Error("unexpected pending choice");
    const result = campaignResultOf(definition, composed.value, finished, events, DEFAULT_DEPS);
    const bySeat = Object.fromEntries(result.records.map((entry) => [entry.write.seatNumber, entry.write.value]));
    expect(bySeat[1]).toEqual({ kind: "cardList", cardIds: ["fp-2"] });
    expect(bySeat[2]).toEqual({ kind: "cardList", cardIds: ["fp-3"] });
  });
});

describe("LogWriteSpec.distinct on a cardList append", () => {
  const definition = record([
    {
      field: "found",
      mode: "append",
      distinct: true,
      value: { kind: "cardsInEncounterDeckAndDiscard", query: FP_QUERY, inPlay: true },
    },
    {
      field: "every",
      mode: "append",
      value: { kind: "cardsInEncounterDeckAndDiscard", query: FP_QUERY, inPlay: true },
    },
  ]);

  it("appends only what the field does not already hold, so a second Victory finding the same cards adds nothing", () => {
    const log = composedLog(definition);
    const once = fold(definition, log, resultFor(definition, log, finishedGame()));
    expect(once.shared.found).toEqual({ kind: "cardList", cardIds: ["fp-1", "fp-2", "fp-3"] });
    // The next scenario's Victory finds the same cards again (MC32: recorded cards are shuffled back in at setup).
    const next = composedLog(definition);
    const seeded: CampaignLog = {
      ...next,
      shared: { ...next.shared, found: once.shared.found!, every: once.shared.every! },
    };
    const twice = fold(definition, seeded, resultFor(definition, seeded, finishedGame()));
    expect(twice.shared.found).toEqual({ kind: "cardList", cardIds: ["fp-1", "fp-2", "fp-3"] });
    // The same write without `distinct` keeps every copy ("Record each copy individually").
    expect(twice.shared.every).toEqual({
      kind: "cardList",
      cardIds: ["fp-1", "fp-2", "fp-3", "fp-1", "fp-2", "fp-3"],
    });
  });

  it("is a multiset union per card id: held [a, a, b] plus found [a, b, b, c] is [a, a, b, b, c]", () => {
    const log = composedLog(definition);
    const seeded: CampaignLog = {
      ...log,
      shared: { ...log.shared, found: { kind: "cardList", cardIds: ["a", "a", "b"].map(cardId) } },
    };
    const result: CampaignGameResult = {
      nodeId: "only",
      outcome: "won",
      records: [
        {
          instructionId: "only.victory.found",
          write: {
            field: "found",
            seatNumber: null,
            mode: "append",
            distinct: true,
            value: { kind: "cardList", cardIds: ["a", "b", "b", "c"].map(cardId) },
          },
        },
      ],
      removedFromCampaign: [],
      logWrites: [],
      expiringGrants: [],
    };
    expect(fold(definition, seeded, result).shared.found).toEqual({
      kind: "cardList",
      cardIds: ["a", "a", "b", "b", "c"],
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// CollectionFilter.notInOwnDeck
// ---------------------------------------------------------------------------------------------------------------

describe("CollectionFilter.notInOwnDeck (MC32 p. 5, role-building)", () => {
  const SPIDER_MAN = cardId("01001a");
  const isPlayer = (card: AnyCard): card is PlayerCard => "deckLimit" in card;
  const events = CORE_CARDS.filter(
    (card): card is PlayerCard => isPlayer(card) && card.type === "event" && card.aspect === "aggression",
  );
  const [held, other] = events;
  if (!held || !other) throw new Error("Core lacks two Aggression events");
  // A reprint: another id with the held card's title.
  const reprint: PlayerCard = { ...held, id: cardId("reprint-of-held") };
  const POOL: readonly AnyCard[] = [...CORE_CARDS, reprint];

  const definition = (notInOwnDeck: boolean): CampaignDefinition =>
    definitionWith([
      {
        id: "only.setup.role-building",
        text: "test",
        citation: "MC32 p. 5",
        step: {
          kind: "betweenGames",
          ops: [
            {
              kind: "forEachSeat",
              ops: [
                {
                  kind: "choose",
                  slot: "roleEvent",
                  chooser: "eachSeat",
                  optional: true,
                  from: {
                    kind: "collection",
                    filter: {
                      categories: ["event"],
                      aspects: ["aggression"],
                      ...(notInOwnDeck ? { notInOwnDeck: true } : {}),
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    ]);
  const optionsFor = (notInOwnDeck: boolean): readonly string[] => {
    const def = definition(notInOwnDeck);
    const log = createCampaignLog(def, {
      id: "run",
      seats: [
        {
          seatNumber: 1,
          identityCardId: SPIDER_MAN,
          deck: { identityCardId: SPIDER_MAN, aspects: ["aggression"], cards: [{ cardId: held.id, quantity: 1 }] },
        },
      ],
      modes: MODES,
      poolVersion: "test",
      seed: 1,
    });
    const pending = resolveBetweenGames(def, log, { pool: POOL }, MODES);
    if (pending.kind !== "pending") throw new Error("expected the role-building choice");
    return pending.choice.options;
  };

  it("leaves out a card the seat's deck already holds, and its reprint by title", () => {
    const offered = optionsFor(true);
    expect(offered).toContain(other.id);
    expect(offered).not.toContain(held.id);
    expect(offered).not.toContain(reprint.id);
  });

  it("without the flag the same card is offered", () => {
    const offered = optionsFor(false);
    expect(offered).toContain(held.id);
    expect(offered).toContain(reprint.id);
  });
});
