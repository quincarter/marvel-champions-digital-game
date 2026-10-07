/**
 * docs/phase7-wave8.md §3.39: `raiseMoment(name, player)` and `on.moment(name)`, a named moment a script raises and
 * other cards answer. The engine's `raise-moment.test.ts` drives the event.
 */

import { describe, expect, it } from "vitest";
import { action, forcedResponse, interrupt, on, response } from "./abilities.js";
import { raiseMoment } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { eventPlayer, you } from "./values.js";

const draw = { kind: "draw", player: you, amount: { kind: "const", value: 1 } } as const;

describe("§3.39 a named moment", () => {
  it("raiseMoment raises it for you by default, or for the player named", () => {
    expect(raiseMoment("missionAttempt")).toEqual({ kind: "raiseMoment", name: "missionAttempt", player: you });
    expect(raiseMoment("missionAttempt", eventPlayer)).toEqual({
      kind: "raiseMoment",
      name: "missionAttempt",
      player: eventPlayer,
    });
    expect(validateDefinition(action(draw, raiseMoment("missionAttempt")))).toEqual([]);
  });

  it("on.moment is after you resolve it; anyPlayer drops the you", () => {
    expect(on.moment("missionAttempt")).toEqual({
      on: "momentRaised",
      playerIs: "controller",
      eventIs: { name: "missionAttempt" },
    });
    expect(on.moment("missionAttempt", { anyPlayer: true })).toEqual({
      on: "momentRaised",
      eventIs: { name: "missionAttempt" },
    });
    expect(validateDefinition(forcedResponse(on.moment("missionAttempt"), draw))).toEqual([]);
    expect(validateDefinition(response(on.moment("energyAbsorption"), draw))).toEqual([]);
  });

  it("a raise with no name, a pattern naming no moment and an interrupt on a moment are refused", () => {
    expect(validateDefinition(action(raiseMoment(" ")))).toEqual(["raiseMoment: a moment needs a name"]);
    expect(validateDefinition(response({ on: "momentRaised", playerIs: "controller" }, draw))).toEqual([
      "a pattern on momentRaised must name its moment: use on.moment(name)",
    ]);
    expect(validateDefinition(response(on.either(on.moment("freeze"), on.youChangeForm()), draw))).toEqual([]);
    expect(validateDefinition(interrupt(on.moment("missionAttempt"), draw))).toEqual([
      "an interrupt cannot answer momentRaised: a raised moment has already happened; use a response",
    ]);
  });
});
