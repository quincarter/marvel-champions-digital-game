/**
 * The DSL builders for three engine primitives a custom-content hero needs before any base card uses them (Agile X,
 * "the last card you played this round", a per-player blank), and `ENGINE_ONLY_DSL_EXAMPLES`, the definitions the mod
 * SDK walks with the base registry so a pack using them is not refused (docs/custom-content-packs.md §6, §11.2).
 */

import { describe, expect, it } from "vitest";
import { agile, VILLAIN_OR_VILLAINOUS } from "./abilities.js";
import { blankTextBoxForPlayers, blankTextBoxUntil } from "./effects.js";
import { ENGINE_ONLY_DSL_EXAMPLES, engineOnlyDslProblems } from "./engine-only-features.js";
import { lastPlayedThisRound, query, self, thatPlayer, you } from "./values.js";

describe("engine-only DSL primitives", () => {
  it("agile(X) is an attack damage reduction for undefended villain and villainous attacks only", () => {
    const hero = { categories: ["hero"], controller: "you" } as const;
    expect(agile(2, hero)).toEqual({
      rules: [
        {
          kind: "reduceDamageTaken",
          target: hero,
          amount: 2,
          fromAttack: true,
          onlyAttacker: VILLAIN_OR_VILLAINOUS,
          onlyUndefended: true,
        },
      ],
    });
  });

  it("lastPlayedThisRound reads 'you' by default", () => {
    expect(lastPlayedThisRound(query("event"))).toEqual({
      kind: "lastPlayedThisRound",
      player: you,
      cards: { categories: ["event"] },
    });
  });

  it("blankTextBoxForPlayers is a blankTextBox with forPlayers; without it the blank is everyone's", () => {
    expect(blankTextBoxForPlayers(self, thatPlayer, "endOfPhase")).toEqual({
      kind: "blankTextBox",
      target: self,
      until: "endOfPhase",
      forPlayers: thatPlayer,
    });
    expect(blankTextBoxUntil(self, "endOfPhase")).toEqual({ kind: "blankTextBox", target: self, until: "endOfPhase" });
  });

  it("every example passes the DSL's validator and there is one per primitive", () => {
    expect(engineOnlyDslProblems()).toEqual([]);
    expect(Object.keys(ENGINE_ONLY_DSL_EXAMPLES).sort()).toEqual([
      "engine-only.agile",
      "engine-only.last-played",
      "engine-only.per-player-blank",
    ]);
  });
});
