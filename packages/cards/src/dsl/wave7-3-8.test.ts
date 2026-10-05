/**
 * docs/phase7-wave7.md §3.8: the DSL builders for "shares a title with" and for a negated query filter. The engine's
 * `shares-title-with.test.ts` proves what the compiled queries select.
 */

import { describe, expect, it } from "vitest";
import { action, chooseCards } from "./index.js";
import { defineAbilities } from "./validate.js";
import { each, notMatching, query, sharesTitleWith, tuckedUnderRef } from "./values.js";

const VILLAIN = { kind: "villain" } as const;
const SELF = { kind: "self" } as const;

describe("§3.8 sharesTitleWith and notMatching", () => {
  it("sharesTitleWith is the query field, ref as given", () => {
    expect(sharesTitleWith(VILLAIN)).toEqual({ sharesTitleWith: { kind: "villain" } });
    // "Each minion that shares a title with the villain."
    expect(query("minion", sharesTitleWith(VILLAIN))).toEqual({
      categories: ["minion"],
      sharesTitleWith: { kind: "villain" },
    });
  });

  it("notMatching negates a filter and leaves the categories outside it", () => {
    // "A minion that does not share a title with a card in play."
    expect(query("minion", notMatching(sharesTitleWith(each({}))))).toEqual({
      categories: ["minion"],
      not: { sharesTitleWith: { kind: "each", query: {} } },
    });
  });

  it("a set-aside search for a villain sharing no title with a card under this card validates", () => {
    const filter = query("villain", notMatching(sharesTitleWith(tuckedUnderRef(SELF))));
    const registry = defineAbilities({
      "99001.next-villain": action(chooseCards("next", { kind: "encounterSetAside", filter }, { min: 1, max: 1 })),
    });
    expect(registry["99001.next-villain"]?.effects).toEqual([
      expect.objectContaining({
        kind: "chooseCards",
        from: {
          kind: "encounterSetAside",
          filter: {
            categories: ["villain"],
            not: { sharesTitleWith: { kind: "tuckedUnder", of: { kind: "self" } } },
          },
        },
      }),
    ]);
  });
});
