/**
 * docs/phase7-wave7.md §3.83: facts from outside the game. `outsideFact` reads a fact the seat supplied at setup
 * (`Predicate outsideFact`); `reportFact` asks a player for one as the card resolves (`EffectSpec reportFact`, read
 * back as `<bind>.amount`). `outside-facts.test.ts` in the engine drives both.
 */

import { describe, expect, it } from "vitest";
import { alterEgoAction, constant, costModifier, forcedResponse } from "./abilities.js";
import { discard, heal, ifThen, reportFact } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { each, not, outsideFact, self, thatPlayer, varAtLeast, varOf, you } from "./values.js";

describe("§3.83 facts from outside the game", () => {
  it("outsideFact defaults to you and takes any player", () => {
    expect(outsideFact("wonPreviousGame")).toEqual({ kind: "outsideFact", fact: "wonPreviousGame", player: you });
    expect(outsideFact("wonPreviousGame", thatPlayer)).toEqual({
      kind: "outsideFact",
      fact: "wonPreviousGame",
      player: thatPlayer,
    });
  });

  it("reportFact defaults to you and takes any player", () => {
    expect(reportFact("minutesAway", "break")).toEqual({
      kind: "reportFact",
      fact: "minutesAway",
      player: you,
      bind: "break",
    });
    expect(reportFact("talkedThisPhase", "talked", thatPlayer)).toEqual({
      kind: "reportFact",
      fact: "talkedThisPhase",
      player: thatPlayer,
      bind: "talked",
    });
  });

  it("'reduce the cost to play this card by 2 if you did not win your previous game' is a hand cost modifier", () => {
    const definition = constant(
      costModifier({
        delta: -2,
        appliesTo: { self: true },
        activeIn: "hand",
        while: not(outsideFact("wonPreviousGame")),
      }),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "constant",
      costModifiers: [
        {
          delta: -2,
          appliesTo: { self: true },
          activeIn: "hand",
          while: { kind: "not", of: { kind: "outsideFact", fact: "wonPreviousGame", player: you } },
        },
      ],
    });
  });

  it("'heal 1 damage from each identity for every minute you were away' reads the reported number", () => {
    const definition = alterEgoAction(
      reportFact("minutesAway", "break"),
      heal(varOf("break.amount"), each({ categories: ["identity"] })),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([
      { kind: "reportFact", fact: "minutesAway", player: you, bind: "break" },
      {
        kind: "heal",
        target: { kind: "each", query: { categories: ["identity"] } },
        amount: { kind: "var", name: "break.amount" },
      },
    ]);
  });

  it("'if you have not talked this phase, discard this card' reads the yes/no report as 1 or 0", () => {
    const definition = forcedResponse(
      { on: "playerPhaseEnded" },
      reportFact("talkedThisPhase", "talked"),
      ifThen(not(varAtLeast("talked.amount")), discard(self)),
    );
    expect(validateDefinition(definition)).toEqual([]);
  });

  it("a report read before it is asked for is a validation problem", () => {
    const unbound = alterEgoAction(heal(varOf("break.amount"), each({ categories: ["identity"] })));
    expect(validateDefinition(unbound)).not.toEqual([]);
  });
});
