/**
 * `refCount` / `tuckedCount`: "the number of cards tucked under [card]" (Med Lab, `rogue` 38028: "(Limit 1 ally at a
 * time.)"). The engine reads it in `engine/src/ref-count.test.ts`. Shapes only (Med Lab is scripted elsewhere).
 */

import { describe, expect, it } from "vitest";
import { refCount, theVillain, tuckedCount, tuckedUnderRef, query, self, valueEquals } from "./values.js";

describe("tuckedCount", () => {
  it("defaults to the cards tucked under this card", () => {
    expect(tuckedCount()).toEqual({ kind: "refCount", of: { kind: "tuckedUnder", of: { kind: "self" } } });
    expect(tuckedCount()).toEqual(refCount(tuckedUnderRef(self)));
  });

  it("takes another card and a filter", () => {
    expect(tuckedCount(theVillain, query("ally"))).toEqual({
      kind: "refCount",
      of: { kind: "tuckedUnder", of: { kind: "villain" }, filter: { categories: ["ally"] } },
    });
  });

  it("Med Lab's 'nothing tucked here' condition", () => {
    expect(valueEquals(tuckedCount(), 0)).toEqual({
      kind: "compare",
      left: { kind: "refCount", of: { kind: "tuckedUnder", of: { kind: "self" } } },
      op: "equalTo",
      right: { kind: "const", value: 0 },
    });
  });
});
