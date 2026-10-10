/**
 * docs/phase7-wave9.md §3.40 (a): `on.cardWouldBeTucked(...)` and `replaceTuckHost(to)`, the builders behind "Forced
 * Interrupt: When a card would be tucked under your identity by a player card effect, tuck it under here instead."
 * (Silk Sense Overload, `silk` 52028). The engine's `tuck-replaced.test.ts` drives the plain data.
 */

import { describe, expect, it } from "vitest";
import {
  forcedInterrupt,
  forcedResponse,
  on,
  replaceTuckHost,
  self,
  andThen,
  tuckCards,
  tuckedUnder,
  validateDefinition,
} from "./index.js";

describe("`on.cardWouldBeTucked`", () => {
  it("with no options hears any tuck under any card", () => {
    expect(on.cardWouldBeTucked()).toEqual({ on: "cardBeingTucked" });
  });
  it("'under your identity by a player card effect' is the host's kind, its player and the tucking card's side", () => {
    expect(on.cardWouldBeTucked({ under: "yourIdentity", by: "playerCard" })).toEqual({
      on: "cardBeingTucked",
      playerIs: "controller",
      eventIs: { under: "identity", by: "playerCard" },
    });
  });
  it("'under an identity' names no player, and `by` alone names no host", () => {
    expect(on.cardWouldBeTucked({ under: "identity" })).toEqual({
      on: "cardBeingTucked",
      eventIs: { under: "identity" },
    });
    expect(on.cardWouldBeTucked({ by: "encounterCard" })).toEqual({
      on: "cardBeingTucked",
      eventIs: { by: "encounterCard" },
    });
  });
});

describe("`replaceTuckHost`", () => {
  it("builds the replacement with the card the tuck lands under", () => {
    expect(replaceTuckHost(self)).toEqual({ kind: "replaceTuckHost", to: { kind: "self" } });
  });
  it("validates in a 'would' interrupt to a tuck, with text after a Then", () => {
    const definition = forcedInterrupt(
      on.cardWouldBeTucked({ under: "yourIdentity", by: "playerCard" }),
      { would: true },
      replaceTuckHost(self),
      andThen(tuckCards(tuckedUnder(self), self)),
    );
    expect(definition.trigger).toMatchObject({ kind: "interrupt", forced: true, would: true });
    expect(validateDefinition(definition)).toEqual([]);
  });
  it("is rejected outside an interrupt to a tuck", () => {
    const elsewhere = forcedInterrupt(on.leavesPlay("self"), replaceTuckHost(self));
    expect(validateDefinition(elsewhere)).toContain(
      "replaceTuckHost needs an interrupt on a tuck about to happen (interrupt(on.cardWouldBeTucked(…), …))",
    );
  });
  it("a response to a tuck about to happen is rejected: the event is interrupt-only", () => {
    const after = forcedResponse(on.cardWouldBeTucked(), tuckCards(tuckedUnder(self), self));
    expect(validateDefinition(after)).toContain(
      "cardBeingTucked is interrupt-only: a tuck about to happen has no response window",
    );
  });
});
