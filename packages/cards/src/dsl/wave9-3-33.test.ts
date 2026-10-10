/**
 * docs/phase7-wave9.md §3.33, the extend: `on.wouldGainStatus(who, statuses)`, the builder behind "Forced Interrupt:
 * When attached enemy would gain a confused or stunned status card, discard this card instead." (Solid Sound
 * Constructs, `aos` 50144). The engine's `status-being-given.test.ts` drives the plain data.
 */

import { describe, expect, it } from "vitest";
import {
  cancelIt,
  discard,
  forcedInterrupt,
  forcedResponse,
  instead,
  on,
  query,
  self,
  validateDefinition,
} from "./index.js";

describe("`on.wouldGainStatus`", () => {
  it("with no arguments hears any status card about to be given to any character", () => {
    expect(on.wouldGainStatus()).toEqual({ on: "statusBeingGiven" });
  });
  it("'attached enemy would gain a confused or stunned status card' is the host and the two types", () => {
    expect(on.wouldGainStatus("host", ["confused", "stunned"])).toEqual({
      on: "statusBeingGiven",
      targetIs: { hostOfSelf: true },
      eventIs: { status: ["confused", "stunned"] },
    });
  });
  it("one type, this card, a query, and 'you' as the giver", () => {
    expect(on.wouldGainStatus("self", "tough")).toEqual({
      on: "statusBeingGiven",
      selfIs: "target",
      eventIs: { status: "tough" },
    });
    expect(on.wouldGainStatus(query("minion"), undefined, { by: "you" })).toEqual({
      on: "statusBeingGiven",
      targetIs: query("minion"),
      playerIs: "controller",
    });
  });
  it("validates as Solid Sound Constructs' forced 'would' interrupt, replaced or cancelled", () => {
    const constructs = forcedInterrupt(
      on.wouldGainStatus("host", ["confused", "stunned"]),
      { would: true },
      instead(discard(self)),
    );
    expect(constructs.trigger).toMatchObject({ kind: "interrupt", forced: true, would: true });
    expect(validateDefinition(constructs)).toEqual([]);
    expect(validateDefinition(forcedInterrupt(on.wouldGainStatus("self"), cancelIt()))).toEqual([]);
  });
  it("a response is rejected: the event is interrupt-only", () => {
    const after = forcedResponse(on.wouldGainStatus("host"), discard(self));
    expect(validateDefinition(after)).toContain(
      "statusBeingGiven is interrupt-only: after a status card is placed is on.statusPlaced",
    );
  });
});
