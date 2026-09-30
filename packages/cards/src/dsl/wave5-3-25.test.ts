/**
 * docs/phase7-wave5.md §3.25: the DSL for "resources generated" (M.O.R.B.I.U.S.) and counters spent as resources
 * (Spider-Ham). Each composition validates and emits exactly the plain data `packages/engine/src/resources-generated
 * .test.ts` drives.
 */

import { describe, expect, it } from "vitest";
import { countersAsResource, forcedResponse, on, resource } from "./abilities.js";
import { dealDamage } from "./effects.js";
import { eventAmount, eventPlayer, identityOf } from "./values.js";
import { validateDefinition } from "./validate.js";

const valid = (definition: Parameters<typeof validateDefinition>[0]) =>
  expect(validateDefinition(definition)).toEqual([]);

describe("§3.25 resources generated (M.O.R.B.I.U.S.)", () => {
  it("'After the engaged player generates any number of resources, deal an equal amount of damage to that player's hero'", () => {
    const definition = forcedResponse(
      on.resourcesGenerated({ by: "engaged" }),
      dealDamage(eventAmount, identityOf(eventPlayer)),
    );
    valid(definition);
    expect(definition.trigger).toEqual({
      kind: "response",
      forced: true,
      on: { on: "resourcesGenerated", playerIn: { kind: "engagedWith", of: { kind: "self" } } },
    });
  });

  it("'after you generate' and 'after a player generates'", () => {
    expect(on.resourcesGenerated({ by: "you" })).toEqual({ on: "resourcesGenerated", playerIs: "controller" });
    expect(on.resourcesGenerated()).toEqual({ on: "resourcesGenerated" });
  });
});

describe("§3.25 counters spent as resources (Spider-Ham)", () => {
  it("'Each toon counter on Spider-Ham can be spent as if it were a [wild] resource'", () => {
    const definition = countersAsResource("toon");
    valid(definition);
    expect(definition).toEqual({
      trigger: { kind: "resource", repeatable: true, spentAsIfResource: true },
      cost: { spendCounters: { counterType: "toon", amount: 1 } },
      effects: [],
      generates: 1,
    });
  });

  it("spending a counter is not generating a resource (§4.1 Q5): only countersAsResource is marked", () => {
    expect(resource(1).trigger).toEqual({ kind: "resource" });
    expect(resource(1, { spentAsIfResource: true }).trigger).toEqual({ kind: "resource", spentAsIfResource: true });
  });

  it("a repeatable resource ability with any cost but one fixed counter cost does not validate", () => {
    expect(validateDefinition(resource(1, { repeatable: true, cost: { exhaustSelf: true } }))).not.toEqual([]);
    expect(
      validateDefinition(
        resource(1, { repeatable: true, cost: { spendCounters: { counterType: "toon", amount: 2, upTo: true } } }),
      ),
    ).not.toEqual([]);
  });
});
