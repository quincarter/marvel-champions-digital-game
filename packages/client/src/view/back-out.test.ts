import { describe, expect, test } from "vitest";
import type { Command, GameEvent, PendingChoice, PlayerId } from "@mc/engine";
import { backOutTargetOf, backOutSubjectName, revealsHiddenInformation, type BackOutTrailEntry } from "./back-out.js";

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

describe("revealsHiddenInformation", () => {
  test("a draw is always revealing", () => {
    expect(revealsHiddenInformation(drawn)).toBe(true);
  });

  test("a card leaving a deck zone is revealing", () => {
    const moved: GameEvent = {
      type: "cardMoved",
      instanceId: "x",
      cardId: "01001",
      from: { kind: "deck", playerId: P1 },
      to: { kind: "discard", playerId: P1 },
    } as unknown as GameEvent;
    expect(revealsHiddenInformation(moved)).toBe(true);
  });

  test("a card moving between two non-deck zones is not revealing", () => {
    const moved: GameEvent = {
      type: "cardMoved",
      instanceId: "x",
      cardId: "01001",
      from: { kind: "hand", playerId: P1 },
      to: { kind: "playArea", playerId: P1 },
    } as unknown as GameEvent;
    expect(revealsHiddenInformation(moved)).toBe(false);
  });

  test("a look/search choice prompt is revealing", () => {
    const requested: GameEvent = {
      type: "choiceRequested",
      choice: choice({ prompt: { kind: "chooseCards", slot: "look" } }),
    } as unknown as GameEvent;
    expect(revealsHiddenInformation(requested)).toBe(true);
  });

  test("an ordinary choice prompt (e.g. choosing a target) is not revealing", () => {
    const requested: GameEvent = {
      type: "choiceRequested",
      choice: choice({ prompt: { kind: "chooseTarget", slot: "x", abilityId: null } }),
    } as unknown as GameEvent;
    expect(revealsHiddenInformation(requested)).toBe(false);
  });

  test("damage/threat/exhaust events are not revealing", () => {
    const damage: GameEvent = { type: "damageDealt", targetInstanceId: "x", amount: 3 } as unknown as GameEvent;
    expect(revealsHiddenInformation(damage)).toBe(false);
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
