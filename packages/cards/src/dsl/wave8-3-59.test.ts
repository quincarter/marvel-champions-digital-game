/**
 * docs/phase7-wave8.md §3.59: the builder for "an upgrade that can be attached to an ally", widened by
 * docs/phase7-wave11.md §3.11 to "… a minion or side scheme". `canAttachToCategory`
 * emits the engine's plain query field (`can-attach-to-category.test.ts` in the engine drives it).
 */

import { describe, expect, it } from "vitest";
import { canAttachToCategory, query } from "./values.js";

describe("§3.59 `canAttachToCategory`", () => {
  it("emits the query field, ANDed with the category", () => {
    expect(query("upgrade", canAttachToCategory("ally"))).toEqual({
      categories: ["upgrade"],
      canAttachToCategory: "ally",
    });
  });
});

describe("§3.11 (wave 11) `canAttachToCategory` with several categories", () => {
  it("one category stays a plain value; several become a list meaning any of them", () => {
    expect(canAttachToCategory("minion")).toEqual({ canAttachToCategory: "minion" });
    expect(query("upgrade", canAttachToCategory("minion", "sideScheme"))).toEqual({
      categories: ["upgrade"],
      canAttachToCategory: ["minion", "sideScheme"],
    });
  });
});
