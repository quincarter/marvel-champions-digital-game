/**
 * docs/phase7-wave6.md §3.57: playing a tucked ally as if from hand, exhausted. `playTuckedCard` emits the
 * `playFromHand { from: { tuckedUnder } }` the engine resolves (`play-tucked.test.ts` drives it); `while` on an interrupt
 * or response is the ability's own condition (`trigger-while.test.ts`), and `after.defeated(…, { consequential })` the
 * defeat by consequential damage. Shapes only (Med Lab, `rogue` 38028, is scripted in `wave6/rogue/rogue/`).
 */

import { describe, expect, it } from "vitest";
import { after, alterEgoAction, exhaustThis, forcedInterrupt, heroInterrupt, on, response } from "./abilities.js";
import { cards, draw, playTuckedCard, tuckCards } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { eventTarget, query, self, tuckedCount, valueEquals } from "./values.js";

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

describe("§3.57 `while` on an interrupt or response, and a defeat by consequential damage", () => {
  const NOTHING_HERE = valueEquals(tuckedCount(), 0);

  it("Med Lab's Response: after an ally is defeated by consequential damage, exhaust → place it here (limit 1)", () => {
    const definition = response(
      after.defeated(query("ally"), { consequential: true }),
      { cost: exhaustThis, while: NOTHING_HERE },
      tuckCards(cards(eventTarget), self),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition).toEqual({
      trigger: {
        kind: "response",
        forced: false,
        on: { on: "characterDefeated", targetIs: { categories: ["ally"] }, consequential: true },
        while: NOTHING_HERE,
      },
      cost: { exhaustSelf: true },
      effects: [{ kind: "tuckCards", cards: { kind: "ref", ref: { kind: "eventTarget" } }, under: { kind: "self" } }],
    });
  });

  it("every triggered builder carries `while`: forced, form-gated, interrupt and response", () => {
    const pattern = on.defeated(query("ally"));
    expect(forcedInterrupt(pattern, { while: NOTHING_HERE }, draw(1)).trigger).toEqual({
      kind: "interrupt",
      forced: true,
      on: pattern,
      while: NOTHING_HERE,
    });
    expect(heroInterrupt(pattern, { while: NOTHING_HERE }, draw(1)).trigger).toEqual({
      kind: "interrupt",
      forced: false,
      on: pattern,
      form: "hero",
      while: NOTHING_HERE,
    });
  });

  it("without the options nothing is added: no `while`, no `consequential`", () => {
    const definition = response(after.defeated(query("ally")), draw(1));
    expect(definition.trigger).toEqual({
      kind: "response",
      forced: false,
      on: { on: "characterDefeated", targetIs: { categories: ["ally"] } },
    });
    expect(after.defeated(query("ally"), { consequential: false })).toEqual({
      on: "characterDefeated",
      targetIs: { categories: ["ally"] },
      consequential: false,
    });
  });
});
