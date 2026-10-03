/**
 * docs/phase7-wave6.md §3.37: `schemeThreatOn`, "When Dark Phoenix schemes, place that threat on Consume the World, if
 * able" (34029). The engine's `scheme-threat-on-named-scheme.test.ts` drives the rule.
 */

import { describe, expect, it } from "vitest";
import { constant, schemeThreatOn } from "./abilities.js";
import { validateDefinition } from "./validate.js";
import { exists, named, query } from "./values.js";

describe("§3.37 `schemeThreatOn`", () => {
  it("Dark Phoenix's shape: a constant rule naming Consume the World", () => {
    const definition = constant(schemeThreatOn({ self: true }, named("Consume the World")));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [
        {
          kind: "schemeThreatDestination",
          enemy: { self: true },
          scheme: { kind: "named", name: "Consume the World" },
        },
      ],
    });
  });

  it("the Wrecking Crew's shape, with a `while`", () => {
    const whileAVillain = exists(query("villain"));
    expect(schemeThreatOn({ self: true }, "ownSignatureSideScheme", { while: whileAVillain })).toEqual({
      rules: [
        {
          kind: "schemeThreatDestination",
          enemy: { self: true },
          scheme: "ownSignatureSideScheme",
          while: whileAVillain,
        },
      ],
    });
  });
});
