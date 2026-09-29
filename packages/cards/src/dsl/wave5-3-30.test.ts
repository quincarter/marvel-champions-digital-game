/**
 * docs/phase7-wave5.md §3.30: a player card attached to an encounter card and returned when its host leaves. Wrist
 * Navigator (`sm` 27189a) composes from `on.entersPlay`, `attachCard` and `on.attachedCardDefeated`; the return to
 * its controller's play area is the engine's rule for a permanent attachment (`attached-player-card-returns.test.ts`).
 */

import { describe, expect, it } from "vitest";
import { forcedResponse, interrupt, on } from "./abilities.js";
import { attachCard, draw } from "./effects.js";
import { eventTarget, query, self } from "./values.js";
import { validateDefinition } from "./validate.js";

const valid = (definition: Parameters<typeof validateDefinition>[0]) =>
  expect(validateDefinition(definition)).toEqual([]);

describe("§3.30 Wrist Navigator", () => {
  it("attaches to each minion or side scheme that enters play, and draws when the attached card is defeated", () => {
    const attach = forcedResponse(on.entersPlay(query(["minion", "sideScheme"])), attachCard(self, eventTarget));
    valid(attach);
    expect(attach).toMatchObject({
      trigger: {
        kind: "response",
        forced: true,
        on: { on: "cardEntersPlay", targetIs: { categories: ["minion", "sideScheme"] } },
      },
      effects: [{ kind: "attach", card: { kind: "self" }, to: { kind: "eventTarget" } }],
    });

    const drawOnDefeat = interrupt(on.attachedCardDefeated(), draw(1));
    valid(drawOnDefeat);
    expect(drawOnDefeat.trigger).toEqual({
      kind: "interrupt",
      forced: false,
      on: { on: ["characterDefeated", "schemeDefeated"], targetIs: { hostOfSelf: true } },
    });
  });
});
