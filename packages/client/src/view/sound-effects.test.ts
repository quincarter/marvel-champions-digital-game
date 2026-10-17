import { describe, expect, test } from "vitest";
import type { CardId } from "@mc/content";
import type { Command, GameEvent, PlayerId } from "@mc/engine";
import { cardEnteredPlay, madeBasicAttack, madeBasicThwart, refilledHand, tableSoundsOf } from "./sound-effects.js";

const P1 = "p1" as PlayerId;
const refill = (drawn: number): GameEvent => ({ type: "handRefilled", playerId: P1, drawn, handSize: 6 }) as GameEvent;
const moved = (from: string, to: string): GameEvent =>
  ({ type: "cardMoved", from: { kind: from, playerId: P1 }, to: { kind: to, playerId: P1 } }) as unknown as GameEvent;
const played = (cardId: string): GameEvent => ({ type: "cardPlayed", playerId: P1, cardId }) as unknown as GameEvent;
const instructed = (power: "attack" | "thwart"): GameEvent =>
  ({ type: "basicPowerInstructed", power }) as unknown as GameEvent;
const traitsOf = (cardId: CardId): readonly string[] => ((cardId as string) === "shield-of-seraphim" ? ["Spell"] : []);

describe("basic powers", () => {
  test("the Attack button, or a card that has a character make one", () => {
    expect(madeBasicAttack({ type: "basicAttack" } as Command, [])).toBe(true);
    expect(madeBasicAttack(undefined, [instructed("attack")])).toBe(true);
    expect(madeBasicAttack(undefined, [instructed("thwart")])).toBe(false);
  });

  test("the Thwart button, or a card that has a character make one", () => {
    expect(madeBasicThwart({ type: "basicThwart" } as Command, [])).toBe(true);
    expect(madeBasicThwart(undefined, [instructed("thwart")])).toBe(true);
    expect(madeBasicThwart({ type: "basicAttack" } as Command, [])).toBe(false);
  });
});

describe("refilledHand", () => {
  test("a refill that drew cards; a full hand draws nothing and makes no sound", () => {
    expect(refilledHand([refill(3)])).toBe(true);
    expect(refilledHand([refill(0)])).toBe(false);
  });
});

describe("cardEnteredPlay", () => {
  test("from a hand or the encounter deck into a play area", () => {
    expect(cardEnteredPlay([moved("hand", "playArea")])).toBe(true);
    expect(cardEnteredPlay([moved("encounterDeck", "villainArea")])).toBe(true);
  });

  test("moving between in-play places, or out of play, is not entering it", () => {
    expect(cardEnteredPlay([moved("playArea", "villainArea")])).toBe(false);
    expect(cardEnteredPlay([moved("playArea", "discard")])).toBe(false);
  });
});

describe("tableSoundsOf", () => {
  test("a card played that makes an attack: the card first, then the punch", () => {
    const entry = { command: undefined, events: [played("swinging-web-kick"), instructed("attack")] };
    expect(tableSoundsOf([entry], traitsOf)).toEqual(["card-played", "basic-attack"]);
  });

  test("a Spell plays the spell sound in place of the card's", () => {
    const entry = { command: undefined, events: [played("shield-of-seraphim"), moved("hand", "playArea")] };
    expect(tableSoundsOf([entry], traitsOf)).toEqual(["spell-cast"]);
  });

  test("a thwart, then the end-of-turn refill", () => {
    expect(tableSoundsOf([{ command: { type: "basicThwart" } as Command, events: [] }], traitsOf)).toEqual([
      "basic-thwart",
    ]);
    expect(tableSoundsOf([{ command: { type: "endTurn" } as Command, events: [refill(2)] }], traitsOf)).toEqual([
      "hand-refill",
    ]);
  });

  test("nothing on the table, nothing to hear", () => {
    expect(tableSoundsOf([{ command: { type: "basicRecover" } as Command, events: [] }], traitsOf)).toEqual([]);
  });
});
