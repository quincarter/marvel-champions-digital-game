/** The `cannotThwart` builder: unscoped (Baron Zemo) and scoped to some schemes (Life-Size Decoy, `sm` 27142). */

import { describe, expect, it } from "vitest";
import { cannotThwart, constant } from "./abilities.js";
import { defineAbilities } from "./validate.js";
import { engagedPlayerOf, query, self, you } from "./values.js";

describe("cannotThwart", () => {
  it("emits the unscoped rule with no schemes field", () => {
    expect(constant(cannotThwart(you)).trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "cannotThwart", player: you }],
    });
  });

  it("emits a scheme scope, and validates", () => {
    const registry = defineAbilities({
      "27142.decoy": constant(cannotThwart(engagedPlayerOf(self), { schemes: query("sideScheme") })),
    });
    expect(registry["27142.decoy"]?.trigger).toEqual({
      kind: "constant",
      rules: [
        {
          kind: "cannotThwart",
          player: { kind: "engagedWith", of: self },
          schemes: { categories: ["sideScheme"] },
        },
      ],
    });
  });
});
