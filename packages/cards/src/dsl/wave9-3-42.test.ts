/**
 * docs/phase7-wave9.md §3.42: `playWithTopOfEncounterDeckFaceup` ("During the player phase, play with the top card of
 * the encounter deck faceup.", Falcon 53001a) and the predicates that read the card it shows:
 * `topOfEncounterDeckIsFaceup`, `topOfEncounterDeckMatches`, `topOfEncounterDeckShowsIcons` and
 * `topOfEncounterDeckShowsNoIcons`. The engine's `encounter-top-faceup.test.ts` drives them, the refusal of RRG 1.8 FAQ
 * "Redwing (#2)" (p. 65) and §4.1 Q6 = B included.
 */

import { describe, expect, it } from "vitest";
import { action, constant, playWithTopOfEncounterDeckFaceup } from "./abilities.js";
import { ifThen } from "./effects.js";
import { validateDefinition } from "./validate.js";
import {
  duringPlayerPhase,
  not,
  topOfEncounterDeckIsFaceup,
  topOfEncounterDeckMatches,
  topOfEncounterDeckShowsIcons,
  topOfEncounterDeckShowsNoIcons,
  you,
} from "./values.js";

const draw = { kind: "draw", player: you, amount: { kind: "const", value: 1 } } as const;

describe("§3.42 the top card of the encounter deck kept faceup", () => {
  it("playWithTopOfEncounterDeckFaceup is a constant rule on the encounter deck, with an optional while", () => {
    expect(constant(playWithTopOfEncounterDeckFaceup())).toEqual({
      trigger: { kind: "constant", rules: [{ kind: "topOfDeckFaceup", deck: "encounter" }] },
      effects: [],
    });
    expect(duringPlayerPhase).toEqual({ kind: "gameStep", phase: "player" });
    expect(playWithTopOfEncounterDeckFaceup({ while: duringPlayerPhase })).toEqual({
      rules: [{ kind: "topOfDeckFaceup", deck: "encounter", while: { kind: "gameStep", phase: "player" } }],
    });
    expect(validateDefinition(constant(playWithTopOfEncounterDeckFaceup({ while: duringPlayerPhase })))).toEqual([]);
  });

  it("the predicates read the rule, the showing card and the icons of its boost area", () => {
    expect(topOfEncounterDeckIsFaceup).toEqual({ kind: "topOfDeckFaceup", deck: "encounter" });
    expect(topOfEncounterDeckMatches({ categories: ["minion"] })).toEqual({
      kind: "topOfDeckFaceup",
      deck: "encounter",
      matches: { categories: ["minion"] },
    });
    expect(topOfEncounterDeckShowsIcons({ atLeast: 2 })).toEqual({
      kind: "topOfDeckFaceup",
      deck: "encounter",
      boostAreaIcons: { atLeast: 2 },
    });
    expect(topOfEncounterDeckShowsNoIcons).toEqual(topOfEncounterDeckShowsIcons({ atMost: 0 }));
    expect(validateDefinition(action(draw, ifThen(not(topOfEncounterDeckShowsNoIcons), draw)))).toEqual([]);
  });

  it("a bound on the icons that asks nothing, or that no count can meet, is rejected", () => {
    const problems = (bound: { atLeast?: number; atMost?: number }) =>
      validateDefinition(action(ifThen(topOfEncounterDeckShowsIcons(bound), draw)));
    expect(problems({})).toEqual([expect.stringContaining("boostAreaIcons needs atLeast or atMost")]);
    expect(problems({ atLeast: -1 })).toEqual([expect.stringContaining("whole numbers of at least 0")]);
    expect(problems({ atMost: 1.5 })).toEqual([expect.stringContaining("whole numbers of at least 0")]);
    expect(problems({ atLeast: 3, atMost: 1 })).toEqual([expect.stringContaining("atLeast is above atMost")]);
    expect(problems({ atLeast: 1, atMost: 1 })).toEqual([]);
  });
});
