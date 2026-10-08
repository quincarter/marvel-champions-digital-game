/**
 * docs/phase7-wave8.md §3.77: the builder for "an attachment with the text 'Hero Action' or 'Hero Response'".
 * `printsAbility(kinds, form)` emits the engine's plain query field (`prints-ability-query.test.ts` in the engine
 * drives it).
 */

import { describe, expect, it } from "vitest";
import { heroAction } from "./abilities.js";
import { chooseTarget, discard } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, printsAbility, query } from "./values.js";

describe("§3.77 `printsAbility`", () => {
  it("emits the query field, ANDed with the category", () => {
    expect(query("attachment", printsAbility(["action", "response"], "hero"))).toEqual({
      categories: ["attachment"],
      printsAbility: { kinds: ["action", "response"], form: "hero" },
    });
    expect(printsAbility(["action"], "alterEgo")).toEqual({ printsAbility: { kinds: ["action"], form: "alterEgo" } });
  });

  it("validates inside an ability; an empty list of kinds is refused by the builder and by the validator", () => {
    const definition = heroAction(
      chooseTarget("attachment", query("attachment", printsAbility(["action", "response"], "hero"))),
      discard(chosen("attachment")),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(() => printsAbility([], "hero")).toThrow(/at least one ability kind/);
    const empty = heroAction(
      chooseTarget("attachment", { categories: ["attachment"], printsAbility: { kinds: [], form: "hero" } }),
      discard(chosen("attachment")),
    );
    expect(validateDefinition(empty).join("\n")).toMatch(/printsAbility needs at least one ability kind/);
  });
});
