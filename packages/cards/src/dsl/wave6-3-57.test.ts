/**
 * docs/phase7-wave6.md §3.57: playing a tucked ally as if from hand, exhausted. `playTuckedCard` emits the
 * `playFromHand { from: { tuckedUnder } }` the engine resolves (`play-tucked.test.ts` drives it). Shapes only (Med Lab,
 * `rogue` 38028, is scripted elsewhere).
 */

import { describe, expect, it } from "vitest";
import { alterEgoAction, exhaustThis } from "./abilities.js";
import { playTuckedCard } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { query } from "./values.js";

describe("§3.57 `playTuckedCard`", () => {
  it("Med Lab's Alter-Ego Action: exhaust Med Lab → play the ally here as if from hand; it enters play exhausted", () => {
    const definition = alterEgoAction({ cost: exhaustThis }, playTuckedCard({ entersExhausted: true }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition).toEqual({
      trigger: { kind: "action", form: "alterEgo" },
      cost: { exhaustSelf: true },
      effects: [
        {
          kind: "playFromHand",
          player: { kind: "controller" },
          from: { tuckedUnder: { kind: "self" } },
          entersExhausted: true,
        },
      ],
    });
  });

  it("defaults: paid normally, required, under this card; the options are carried through", () => {
    expect(playTuckedCard()).toEqual({
      kind: "playFromHand",
      player: { kind: "controller" },
      from: { tuckedUnder: { kind: "self" } },
    });
    expect(
      playTuckedCard({
        under: { kind: "villain" },
        filter: query("ally"),
        ignoreCost: true,
        optional: true,
      }),
    ).toEqual({
      kind: "playFromHand",
      player: { kind: "controller" },
      from: { tuckedUnder: { kind: "villain" } },
      ignoreCost: true,
      filter: query("ally"),
      optional: true,
    });
  });
});
