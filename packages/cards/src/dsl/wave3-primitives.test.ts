/**
 * docs/phase7-wave3.md §3.28–§3.36: the DSL builders for the second `gmw` primitives pass. Each builder emits exactly
 * the plain data the engine tests (`packages/engine/src/gmw-compositions.test.ts` and the per-primitive files) drive,
 * and the compositions docs/phase7-wave3-scripting.md gives the scripter validate.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { exhaustThis, heroAction, heroResponse, on, removeCounter, response } from "./abilities.js";
import { cards, chooseCards, eachTimeUntil, heal, moveCards, ready, reduceNextCardCost, zone } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, query, you, YOUR_IDENTITY, yourIdentity } from "./values.js";

const valid = (definition: Parameters<typeof validateDefinition>[0]) =>
  expect(validateDefinition(definition)).toEqual([]);

describe("§3.28–§3.31 compositions", () => {
  it("Lashing Vines: after your identity uses a basic power", () => {
    const vines = heroResponse(
      on.basicPowerUsed(YOUR_IDENTITY),
      { cost: [removeCounter("growth", 2, { fromIdentity: true }), exhaustThis] },
      ready(yourIdentity),
    );
    valid(vines);
    expect(vines.trigger).toMatchObject({ kind: "response", form: "hero", on: { on: "basicPowerUsed" } });
  });

  it("Deft Focus: the next superpower card this turn", () => {
    valid(heroAction({ cost: exhaustThis }, reduceNextCardCost(you, 1, "turn", { trait: trait("SUPERPOWER") })));
  });

  it("Schadenfreude: eachTimeUntil + on.youDealDamage", () => {
    const schadenfreude = heroAction(
      eachTimeUntil("endOfTurn", on.youDealDamage(query("enemy")), heal(2, yourIdentity)),
    );
    valid(schadenfreude);
    expect(schadenfreude.effects[0]).toEqual({
      kind: "eachTimeUntil",
      until: "endOfTurn",
      on: {
        on: "dealDamage",
        sourceIs: { controller: "you", categories: ["identity", "event", "resource", "upgrade"] },
        targetIs: { categories: ["enemy"] },
        eventAtLeast: { amount: 1 },
      },
      effects: [{ kind: "heal", target: yourIdentity, amount: { kind: "const", value: 2 } }],
    });
  });

  it("Salvage: after you spend this card", () => {
    valid(
      response(
        on.youSpendThis(),
        chooseCards("tech", zone("discard", you, { filter: query("upgrade", { trait: trait("TECH") }) }), {
          min: 1,
          max: 1,
        }),
        moveCards(cards(chosen("tech")), "deckTop"),
      ),
    );
  });
});
