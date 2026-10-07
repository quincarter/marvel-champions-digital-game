/**
 * Two wave 7 builders: `basicPowerIs` (`Predicate basicPowerIs`: which basic power is being used, for "add X-23's
 * matching power", Sisterly Bond 43007) and the `indirect` option of `on.damage` / `after.damage`
 * (`EventPattern.indirect`: "after a friendly character takes any amount of indirect damage", Hook, Line, and Sinker
 * 42026; RRG 1.8 "Indirect Damage", p. 24). The engine's `basic-power-is.test.ts` and
 * `indirect-damage-pattern.test.ts` drive both.
 */

import { describe, expect, it } from "vitest";
import { after, heroInterrupt, on } from "./abilities.js";
import { ifThen, modifyBasicPower } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { basicPowerIs, FRIENDLY_CHARACTER, query, statOf, yourIdentity } from "./values.js";

describe("basicPowerIs", () => {
  it("one power is carried as a string, several as a list", () => {
    expect(basicPowerIs("thwart")).toEqual({ kind: "basicPowerIs", power: "thwart" });
    expect(basicPowerIs("thwart", "attack")).toEqual({ kind: "basicPowerIs", power: ["thwart", "attack"] });
    expect(basicPowerIs("defense")).toEqual({ kind: "basicPowerIs", power: "defense" });
    expect(basicPowerIs("recover")).toEqual({ kind: "basicPowerIs", power: "recover" });
  });

  it("an interrupt that adds your identity's matching power to an ally's thwart or attack validates", () => {
    const definition = heroInterrupt(
      on.basicPowerUsing(query("ally", { controller: "you" }), { power: ["thwart", "attack"] }),
      ifThen(
        basicPowerIs("thwart"),
        modifyBasicPower(statOf(yourIdentity, "thw")),
        modifyBasicPower(statOf(yourIdentity, "atk")),
      ),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([
      {
        kind: "if",
        condition: { kind: "basicPowerIs", power: "thwart" },
        then: [{ kind: "modifyBasicPower", amount: { kind: "stat", of: yourIdentity, stat: "thw" } }],
        otherwise: [{ kind: "modifyBasicPower", amount: { kind: "stat", of: yourIdentity, stat: "atk" } }],
      },
    ]);
  });
});

describe("the `indirect` option of the damage patterns", () => {
  it("`indirect: true` asks for indirect damage, `false` excludes it, and without it the pattern has no such field", () => {
    expect(after.damage(FRIENDLY_CHARACTER, { indirect: true, taken: true })).toMatchObject({
      on: "dealDamage",
      indirect: true,
      requireResults: { amount: 1 },
    });
    expect(on.damage(FRIENDLY_CHARACTER, { indirect: false })).toMatchObject({ on: "dealDamage", indirect: false });
    expect(after.damage(FRIENDLY_CHARACTER, { taken: true })).not.toHaveProperty("indirect");
  });
});
