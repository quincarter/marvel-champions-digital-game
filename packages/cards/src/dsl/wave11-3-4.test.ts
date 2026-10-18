/**
 * docs/phase7-wave11.md §3.4: "Interrupt: When you ... remove the last threat from attached scheme, ...".
 * `on.removesLastThreat` is `EventPattern.removesLastThreat` on a `removeThreat` interrupt
 * (`event-pattern-removes-last-threat.test.ts` in the engine drives it; RRG 1.8 "Interrupt", p. 25).
 */

import { describe, expect, it } from "vitest";
import { on } from "./abilities.js";

describe("§3.4 an interrupt to the removal of a scheme's last threat", () => {
  it("'when you remove the last threat from attached scheme' names the host and you as the remover", () => {
    expect(on.removesLastThreat("host", { byYou: true })).toEqual({
      on: "removeThreat",
      targetIs: { hostOfSelf: true },
      removesLastThreat: true,
      playerIn: { kind: "controller" },
    });
  });

  it("control: without byYou, any removal of the last threat", () => {
    expect(on.removesLastThreat("self")).toEqual({ on: "removeThreat", selfIs: "target", removesLastThreat: true });
  });
});
