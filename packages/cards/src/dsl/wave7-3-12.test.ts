/**
 * docs/phase7-wave7.md §3.12: the DSL builder for "If the previous stage was advanced by …". The engine's
 * `main-scheme-advanced-by.test.ts` proves what each cause records and what the predicate reads.
 */

import { describe, expect, it } from "vitest";
import { whenRevealed } from "./abilities.js";
import { giveStatus, ifThen } from "./effects.js";
import { defineAbilities } from "./validate.js";
import { each, mainSchemeAdvancedBy, query, self } from "./values.js";

describe("§3.12 mainSchemeAdvancedBy", () => {
  it("'advanced by knock counters' is a card effect of the scheme itself, in the next stage's When Revealed", () => {
    const allies = each(query("ally"));
    const registry = defineAbilities({
      "99012a.when-revealed": whenRevealed(
        ifThen(mainSchemeAdvancedBy("cardEffect", self), giveStatus(allies, "tough")),
      ),
    });
    expect(registry["99012a.when-revealed"]?.effects).toEqual([
      {
        kind: "if",
        condition: { kind: "mainSchemeAdvancedBy", cause: "cardEffect", source: { kind: "self" } },
        then: [giveStatus(allies, "tough")],
      },
    ]);
  });

  it("without a source it asks only for the cause, with no `source` field", () => {
    expect(mainSchemeAdvancedBy("completed")).toEqual({ kind: "mainSchemeAdvancedBy", cause: "completed" });
    expect(mainSchemeAdvancedBy("cardEffect")).toEqual({ kind: "mainSchemeAdvancedBy", cause: "cardEffect" });
  });
});
