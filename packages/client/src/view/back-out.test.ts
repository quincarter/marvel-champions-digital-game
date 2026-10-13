import { describe, expect, test } from "vitest";
import type { Command, GameEvent, PendingChoice, PlayerId } from "@mc/engine";
import { backOutTargetOf, backOutSubjectName, type BackOutTrailEntry } from "./back-out.js";

const P1 = "p1" as PlayerId;
const P2 = "p2" as PlayerId;

function choice(overrides: Partial<PendingChoice> = {}): PendingChoice {
  return {
    choiceId: "c1" as PendingChoice["choiceId"],
    playerId: P1,
    prompt: { kind: "chooseOption" },
    minSelections: 1,
    maxSelections: 1,
    options: [],
    frameId: null,
    ordered: false,
    soleDecider: false,
    authority: "player",
    ...overrides,
  };
}

function playCard(playerId: PlayerId): Command {
  return {
    type: "playCard",
    playerId,
    cardInstanceId: "i1",
    payment: [],
    attachToInstanceId: null,
  } as unknown as Command;
}

function resolveChoice(playerId: PlayerId): Command {
  return {
    type: "resolveChoice",
    playerId,
    choiceId: "c1",
    selectedOptionIds: [],
  } as unknown as Command;
}

function entry(playerId: PlayerId, command: Command, events: readonly GameEvent[] = []): BackOutTrailEntry {
  return { playerId, command, events };
}

const drawn: GameEvent = { type: "cardDrawn", playerId: P1, instanceId: "drawn" } as unknown as GameEvent;

const ev = (e: object): GameEvent => e as unknown as GameEvent;
const choiceOf = (): PendingChoice => choice({ playerId: P1 });

describe("backOutTargetOf: the same gate as Undo", () => {
  test("a draw, a card leaving a deck and a deck-looking prompt stop it", () => {
    const moved = ev({
      type: "cardMoved",
      instanceId: "x",
      cardId: "01001",
      from: { kind: "deck", playerId: P1 },
      to: { kind: "discard", playerId: P1 },
    });
    const looking = ev({ type: "choiceRequested", choice: choice({ prompt: { kind: "chooseCards", slot: "look" } }) });
    for (const event of [drawn, moved, looking]) {
      expect(backOutTargetOf([entry(P1, playCard(P1), [event])], choiceOf(), P1)).toBeNull();
    }
  });

  test.each([
    "cardFound",
    "deckTopShown",
    "encounterTopShown",
    "hiddenPileRevealed",
    "revealedInPlay",
    "cardsRearranged",
    "cardsSwapped",
    "revealedCardDiscarded",
  ])("%s stops it, in the initiating command and in a later answer", (type) => {
    const event = ev({ type });
    expect(backOutTargetOf([entry(P1, playCard(P1), [event])], choiceOf(), P1)).toBeNull();
    const later = [entry(P1, playCard(P1), []), entry(P1, resolveChoice(P1), [event])];
    expect(backOutTargetOf(later, choiceOf(), P1)).toBeNull();
  });

  test("a command that moved the RNG (a random discard from hand) stops it, whatever its events", () => {
    const discard = ev({ type: "cardDiscardedFromHand", playerId: P1, instanceId: "h1" });
    const random: BackOutTrailEntry = { ...entry(P1, playCard(P1), [discard]), rngDraws: { before: 3, after: 4 } };
    expect(backOutTargetOf([random], choiceOf(), P1)).toBeNull();
    // The same discard, chosen by the player (no draw spent), is a plain visible move.
    const chosen: BackOutTrailEntry = { ...entry(P1, playCard(P1), [discard]), rngDraws: { before: 3, after: 3 } };
    expect(backOutTargetOf([chosen], choiceOf(), P1)).toBe(0);
  });

  test("a plain mis-click on a choice with only visible, deterministic events is allowed", () => {
    const events = [
      ev({
        type: "cardMoved",
        instanceId: "x",
        cardId: "01001",
        from: { kind: "hand", playerId: P1 },
        to: { kind: "playArea", playerId: P1 },
      }),
      ev({ type: "damageDealt", targetInstanceId: "x", amount: 3 }),
      ev({ type: "choiceRequested", choice: choice({ prompt: { kind: "chooseTarget", slot: "x", abilityId: null } }) }),
    ];
    const trail = [entry(P1, playCard(P1), events)];
    expect(backOutTargetOf(trail, choiceOf(), P1)).toBe(0);
  });
});

describe("backOutTargetOf", () => {
  test("offers back-out right after the player's own playCard opened a choice, with nothing revealed", () => {
    const trail = [entry(P1, playCard(P1), [])];
    const target = backOutTargetOf(trail, choice({ playerId: P1 }), P1);
    expect(target).toBe(0);
  });

  test("walks back over the player's own resolveChoice answers inside the same resolution", () => {
    const trail = [entry(P1, playCard(P1), []), entry(P1, resolveChoice(P1), []), entry(P1, resolveChoice(P1), [])];
    const target = backOutTargetOf(trail, choice({ playerId: P1 }), P1);
    expect(target).toBe(0);
  });

  test("is null once a draw happened since the initiating command", () => {
    const trail = [entry(P1, playCard(P1), [drawn]), entry(P1, resolveChoice(P1), [])];
    expect(backOutTargetOf(trail, choice({ playerId: P1 }), P1)).toBeNull();
  });

  test("is null when the choice belongs to a different player than the perspective", () => {
    const trail = [entry(P1, playCard(P1), [])];
    expect(backOutTargetOf(trail, choice({ playerId: P2 }), P1)).toBeNull();
  });

  test("is null when the initiating command isn't playCard/useAbility (e.g. an encounter reveal or another player's turn)", () => {
    const trail = [entry(P1, resolveChoice(P1), [])];
    expect(backOutTargetOf(trail, choice({ playerId: P1 }), P1)).toBeNull();
  });

  test("is null when a resolveChoice in between belongs to a different player", () => {
    const trail = [entry(P1, playCard(P1), []), entry(P2, resolveChoice(P2), [])];
    expect(backOutTargetOf(trail, choice({ playerId: P1 }), P1)).toBeNull();
  });

  test("is null on an empty trail (e.g. right after a resume)", () => {
    expect(backOutTargetOf([], choice({ playerId: P1 }), P1)).toBeNull();
  });
});

describe("backOutSubjectName", () => {
  test("names the card a playCard command played", () => {
    const trail = [entry(P1, playCard(P1), [])];
    expect(backOutSubjectName(trail, 0, () => "Nova")).toBe("Nova");
  });

  test("is null for a target index outside the trail", () => {
    expect(backOutSubjectName([], 0, () => "Nova")).toBeNull();
  });
});
