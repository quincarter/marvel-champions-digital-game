/**
 * docs/phase7-wave7.md §3.32: "X is the number of cards of the most common type in your hand".
 * `mostCommonHandTypeCount` emits `ValueSpec largestHandTypeGroup`, which the engine reads
 * (`largest-hand-type-group.test.ts` drives it); the "at least 3 cards of the same type" threshold is that value in
 * the existing `valueAtLeast`.
 */

import { describe, expect, it } from "vitest";
import { action, constant, gets } from "./abilities.js";
import { forEachPlayer, ifThen, placeThreat } from "./effects.js";
import { validateDefinition } from "./validate.js";
import {
  attackedPlayer,
  defeatingPlayer,
  eachPlayer,
  theMainScheme,
  mostCommonHandTypeCount,
  not,
  self,
  thatPlayer,
  valueAtLeast,
  you,
} from "./values.js";

describe("§3.32 the most common card type in a hand", () => {
  it("defaults to your hand and takes any player", () => {
    expect(mostCommonHandTypeCount()).toEqual({ kind: "largestHandTypeGroup", player: you });
    expect(mostCommonHandTypeCount(thatPlayer)).toEqual({ kind: "largestHandTypeGroup", player: thatPlayer });
  });

  it("'gets +X ATK, where X is the number of cards of the most common type in your hand'", () => {
    const definition = constant(gets("atk", mostCommonHandTypeCount(), { self: true }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toMatchObject({
      kind: "constant",
      modifiers: [{ stat: "atk", amount: { kind: "largestHandTypeGroup", player: you }, target: { self: true } }],
    });
  });

  it("'While [this villain] is attacking you, he gets +X ATK … in your hand': the attacked player's hand", () => {
    expect(attackedPlayer()).toEqual({ kind: "attackedPlayer" });
    expect(attackedPlayer(self)).toEqual({ kind: "attackedPlayer", attacker: { kind: "self" } });
    const definition = constant(gets("atk", mostCommonHandTypeCount(attackedPlayer(self)), { self: true }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toMatchObject({
      kind: "constant",
      modifiers: [
        {
          stat: "atk",
          amount: { kind: "largestHandTypeGroup", player: { kind: "attackedPlayer", attacker: { kind: "self" } } },
          target: { self: true },
        },
      ],
    });
    // The same player in a `while`: "+2 ATK while attacking a player with at least 3 cards of the same type in hand".
    const gated = constant(
      gets("atk", 2, { self: true }, { while: valueAtLeast(mostCommonHandTypeCount(attackedPlayer(self)), 3) }),
    );
    expect(validateDefinition(gated)).toEqual([]);
  });

  it("'each player places X threat here … in their hand'", () => {
    const definition = action(
      forEachPlayer(eachPlayer, placeThreat(mostCommonHandTypeCount(thatPlayer), theMainScheme)),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([
      {
        kind: "forEachPlayer",
        players: eachPlayer,
        effects: [
          { kind: "placeThreat", target: theMainScheme, amount: { kind: "largestHandTypeGroup", player: thatPlayer } },
        ],
      },
    ]);
  });

  it("'does not have at least 3 cards of the same type in their hand' is the value compared with 3", () => {
    const fewerThanThree = not(valueAtLeast(mostCommonHandTypeCount(defeatingPlayer), 3));
    expect(fewerThanThree).toEqual({
      kind: "not",
      of: {
        kind: "compare",
        left: { kind: "largestHandTypeGroup", player: defeatingPlayer },
        op: "atLeast",
        right: { kind: "const", value: 3 },
      },
    });
    expect(validateDefinition(action(ifThen(fewerThanThree, placeThreat(1, theMainScheme))))).toEqual([]);
  });
});
