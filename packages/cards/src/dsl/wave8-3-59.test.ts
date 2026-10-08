/**
 * docs/phase7-wave8.md §3.59: the builder for "an upgrade that can be attached to an ally". `canAttachToCategory`
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
