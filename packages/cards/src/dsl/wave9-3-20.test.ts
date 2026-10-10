/**
 * docs/phase7-wave9.md §3.20: `replaceLeaveDestination({ tuckedUnder })`, the builder behind "Forced Interrupt: When
 * an ally leaves play, tuck it under here and place threat here equal to its cost. Then, place 1 acceleration token
 * here." The engine's `leave-tucked-instead.test.ts` drives the plain data.
 */

import { describe, expect, it } from "vitest";
import {
  addAccelerationToken,
  andThen,
  eventTarget,
  forcedInterrupt,
  forcedResponse,
  on,
  placeThreat,
  printedCostOf,
  query,
  replaceLeaveDestination,
  self,
  validateDefinition,
} from "./index.js";

const MESSAGE = "replaceLeaveDestination needs an interrupt on a card leaving play (interrupt(on.leavesPlay(…), …))";

describe("`replaceLeaveDestination`", () => {
  it("builds the replacement with the card the leaving card ends under", () => {
    expect(replaceLeaveDestination({ tuckedUnder: self })).toEqual({
      kind: "replaceLeaveDestination",
      to: { tuckedUnder: { kind: "self" } },
    });
  });
  it("validates in a forced interrupt to an ally leaving play, with threat by its cost and a Then", () => {
    const definition = forcedInterrupt(
      on.leavesPlay(query("ally")),
      replaceLeaveDestination({ tuckedUnder: self }),
      placeThreat(printedCostOf(eventTarget), self),
      andThen(addAccelerationToken(self)),
    );
    expect(definition.trigger).toMatchObject({ kind: "interrupt", forced: true, on: { on: "cardLeavesPlay" } });
    expect(definition.effects[0]).toEqual({ kind: "replaceLeaveDestination", to: { tuckedUnder: { kind: "self" } } });
    expect(validateDefinition(definition)).toEqual([]);
  });
  it("is rejected in a response: the card has left play by then", () => {
    const after = forcedResponse(on.leavesPlay(query("ally")), replaceLeaveDestination({ tuckedUnder: self }));
    expect(validateDefinition(after)).toContain(MESSAGE);
  });
  it("is rejected in an interrupt to another event", () => {
    const elsewhere = forcedInterrupt(on.cardWouldBeTucked(), replaceLeaveDestination({ tuckedUnder: self }));
    expect(validateDefinition(elsewhere)).toContain(MESSAGE);
  });
});
