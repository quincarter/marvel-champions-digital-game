/**
 * docs/phase7-wave6.md §3.13: "loses [keyword]". `losesKeyword` emits a `KeywordGrantSpec` with `loses: true`, which the
 * engine's `keywordsOf` applies after every grant (`keyword-loss.test.ts` drives it).
 */

import { describe, expect, it } from "vitest";
import { constant, losesKeyword } from "./abilities.js";
import { validateDefinition } from "./validate.js";
import { inPlay, query } from "./values.js";

describe("§3.13 `losesKeyword`", () => {
  it("Physical Strain's shape: Magneto loses steady", () => {
    const definition = constant(losesKeyword({ name: "steady" }, query("villain", { name: "Magneto" })));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "constant",
      keywordGrants: [
        { keyword: { name: "steady" }, target: { categories: ["villain"], name: "Magneto" }, loses: true },
      ],
    });
  });

  it("a numbered keyword needs only its name; `while` is carried through", () => {
    const definition = constant(losesKeyword({ name: "retaliate" }, query("minion"), { while: inPlay("Sabretooth") }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "constant",
      keywordGrants: [
        {
          keyword: { name: "retaliate" },
          target: { categories: ["minion"] },
          loses: true,
          while: { kind: "exists", query: { name: "Sabretooth" } },
        },
      ],
    });
  });
});
