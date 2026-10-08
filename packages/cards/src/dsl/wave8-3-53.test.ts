/**
 * docs/phase7-wave8.md §3.53: the builder for a classification named outright, "an identity-specific ally".
 * `ofClassification(c)` emits the engine's plain query field (`host-classification.test.ts` in the engine drives it).
 */

import { describe, expect, it } from "vitest";
import { ofClassification, query } from "./values.js";

describe("§3.53 `ofClassification`", () => {
  it("emits the query field, ANDed with the rest of the query", () => {
    expect(query("ally", { ...ofClassification("identitySpecific"), controller: "you" })).toEqual({
      categories: ["ally"],
      classification: "identitySpecific",
      controller: "you",
    });
    expect(ofClassification("basic")).toEqual({ classification: "basic" });
    expect(ofClassification("aspect")).toEqual({ classification: "aspect" });
  });
});
