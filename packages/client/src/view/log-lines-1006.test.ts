/**
 * Issue #1006 sections 1.1 and 1.2: a hand discard is "to help pay" only when the command's own events show another
 * seat's play it pays for (not from the state after the command), a mulligan's discards read as a mulligan for both
 * seats, and a card that was faceup when an event happened is named by its face though the command ends with it hidden.
 */

import { beforeAll, describe, expect, test } from "vitest";
import { appendEvents, emptyLog } from "./log-lines.js";
import type { EncounterDeckId, GameEvent, GameState, InstanceId, PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";

let state: GameState;
let p1: PlayerId;
let p2: PlayerId;
let hand1: readonly InstanceId[];
let hand2: readonly InstanceId[];
let deckCards: InstanceId[];
let deckId: EncounterDeckId;

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-she-hulk-aggression" }],
    seed: 3,
  });
  state = store.state.game!;
  p1 = state.players[0]!.playerId;
  p2 = state.players[1]!.playerId;
  hand1 = state.players[0]!.hand;
  hand2 = state.players[1]!.hand;
  const [id, encounterDeck] = Object.entries(state.encounterDecks)[0]!;
  deckId = id as EncounterDeckId;
  deckCards = [...encounterDeck.deck];
}, 30_000);

const lines = (events: readonly GameEvent[], viewer: PlayerId = p1): string[] =>
  appendEvents(emptyLog(), events, state, viewer, POOL_DEPS).lines.map((line) => line.text);
const cardIdOf = (id: InstanceId) => state.instances[id]!.cardId;
const discard = (playerId: PlayerId, id: InstanceId): GameEvent[] => [
  {
    type: "cardMoved",
    instanceId: id,
    cardId: cardIdOf(id),
    from: { kind: "hand", playerId },
    to: { kind: "discard", playerId },
  },
  { type: "cardDiscardedFromHand", playerId, instanceId: id },
];

describe("hand discards (1.1)", () => {
  test("a mulligan reads as one for both seats, though the command ends the setup", () => {
    const events: GameEvent[] = [
      ...discard(p1, hand1[0]!),
      {
        type: "stepChanged",
        from: { phase: "setup", kind: "mulligan", remainingPlayerIds: [p1, p2] },
        to: { phase: "setup", kind: "mulligan", remainingPlayerIds: [p2] },
      } as GameEvent,
      ...discard(p2, hand2[0]!),
      {
        type: "stepChanged",
        from: { phase: "setup", kind: "mulligan", remainingPlayerIds: [p2] },
        to: { phase: "player", kind: "turn", activePlayerId: p1, remainingPlayerIds: [] },
      } as GameEvent,
    ];
    const out = lines(events);
    expect(out.filter((l) => l.endsWith("in the mulligan."))).toHaveLength(2);
    expect(out.some((l) => /help pay/.test(l))).toBe(false);
  });

  test("another seat's discard before a play is help paying for it", () => {
    const events: GameEvent[] = [
      ...discard(p2, hand2[0]!),
      {
        type: "paymentCommitted",
        playerId: p1,
        payingForInstanceId: hand1[0]!,
        fromHand: [
          {
            instanceId: hand2[0]!,
            cardId: cardIdOf(hand2[0]!),
            spenderId: p2,
            resources: { physical: 0, mental: 0, energy: 1, wild: 0 },
          },
        ],
      } as GameEvent,
      {
        type: "cardPlayed",
        playerId: p1,
        instanceId: hand1[0]!,
        cardId: cardIdOf(hand1[0]!),
        resourcesPaid: 1,
        paid: { physical: 0, mental: 0, energy: 1, wild: 0 },
      } as GameEvent,
    ];
    expect(lines(events).filter((l) => l.endsWith("to help pay."))).toHaveLength(1);
  });

  test("the player's own payment and an effect's discard by another seat are not help", () => {
    const own: GameEvent[] = [
      ...discard(p1, hand1[1]!),
      {
        type: "cardPlayed",
        playerId: p1,
        instanceId: hand1[0]!,
        cardId: cardIdOf(hand1[0]!),
        resourcesPaid: 1,
        paid: { physical: 0, mental: 0, energy: 1, wild: 0 },
      } as GameEvent,
    ];
    expect(lines(own).some((l) => /help pay/.test(l))).toBe(false);
    // Hunted by Hydra style: the other seat discards inside an effect, in a command that also holds a play after it.
    const effect: GameEvent[] = [
      ...discard(p2, hand2[0]!),
      { type: "damageDealt", targetInstanceId: hand1[0]!, amount: 1, sourceInstanceId: hand1[0]! } as GameEvent,
      {
        type: "cardPlayed",
        playerId: p1,
        instanceId: hand1[0]!,
        cardId: cardIdOf(hand1[0]!),
        resourcesPaid: 0,
        paid: { physical: 0, mental: 0, energy: 0, wild: 0 },
      } as GameEvent,
    ];
    expect(lines(effect).some((l) => /help pay/.test(l))).toBe(false);
  });
});

describe("cards faceup at the event (1.2)", () => {
  test("a card discarded from the encounter deck is named though a reset hid it again", () => {
    const id = deckCards[0]!;
    const events: GameEvent[] = [
      {
        type: "cardMoved",
        instanceId: id,
        cardId: cardIdOf(id),
        from: { kind: "encounterDeck", deckId },
        to: { kind: "encounterDiscard", deckId },
      },
      { type: "cardDiscardedFromEncounterDeck", instanceId: id } as GameEvent,
    ];
    const text = lines(events).join("\n");
    expect(text).not.toMatch(/facedown/);
    expect(text).toMatch(/is discarded from the encounter deck/);
  });

  test("a revealed card shuffled back is named by the reveal", () => {
    const id = deckCards[1]!;
    const events: GameEvent[] = [
      {
        type: "cardMoved",
        instanceId: id,
        cardId: cardIdOf(id),
        from: { kind: "encounterDeck", deckId },
        to: { kind: "dealtEncounter", playerId: p1 },
      },
      { type: "encounterCardRevealed", instanceId: id, cardId: cardIdOf(id), playerId: p1 },
      {
        type: "cardMoved",
        instanceId: id,
        cardId: cardIdOf(id),
        from: { kind: "dealtEncounter", playerId: p1 },
        to: { kind: "encounterDeck", deckId },
      },
    ];
    expect(lines(events).join("\n")).not.toMatch(/facedown card/);
  });

  test("a card dealt facedown and never revealed stays a facedown card", () => {
    const id = deckCards[2]!;
    const events: GameEvent[] = [
      {
        type: "cardMoved",
        instanceId: id,
        cardId: cardIdOf(id),
        from: { kind: "encounterDeck", deckId },
        to: { kind: "dealtEncounter", playerId: p1 },
      },
      { type: "cardDiscardedFromEncounterDeck", instanceId: id } as GameEvent,
    ];
    expect(lines(events).join("\n")).toMatch(/a facedown card is discarded from the encounter deck/);
  });
});
