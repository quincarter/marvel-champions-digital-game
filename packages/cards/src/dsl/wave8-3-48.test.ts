/**
 * docs/phase7-wave8.md §3.48 and §3.50: `playWithTopOfDeckFaceup` ("Play with the top card of your deck faceup."), and
 * the predicates that read the card it shows: `topOfDeckIsFaceup`, `topOfDeckMatches` and `topOfYourDeckHas` ("the top
 * card of your deck has a [type] or [wild] resource icon"). The engine's `top-of-deck-faceup.test.ts` drives them,
 * including §4.1 Q26 = B: a facedown top card satisfies no condition.
 */

import { describe, expect, it } from "vitest";
import { action, constant, playWithTopOfDeckFaceup } from "./abilities.js";
import { ifThen } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { eventPlayer, isHero, topOfDeckIsFaceup, topOfDeckMatches, topOfYourDeckHas, you } from "./values.js";

const draw = { kind: "draw", player: you, amount: { kind: "const", value: 1 } } as const;

describe("§3.48 the top card of your deck kept faceup", () => {
  it("playWithTopOfDeckFaceup is a constant rule on your deck, with an optional while", () => {
    expect(constant(playWithTopOfDeckFaceup())).toEqual({
      trigger: { kind: "constant", rules: [{ kind: "topOfDeckFaceup", player: you }] },
      effects: [],
    });
    expect(playWithTopOfDeckFaceup(eventPlayer, { while: isHero() })).toEqual({
      rules: [{ kind: "topOfDeckFaceup", player: eventPlayer, while: isHero() }],
    });
    expect(validateDefinition(constant(playWithTopOfDeckFaceup()))).toEqual([]);
  });

  it("topOfDeckIsFaceup reads the rule; topOfDeckMatches reads the card it shows", () => {
    expect(topOfDeckIsFaceup()).toEqual({ kind: "topOfDeckFaceup", player: you });
    expect(topOfDeckIsFaceup(eventPlayer)).toEqual({ kind: "topOfDeckFaceup", player: eventPlayer });
    expect(topOfDeckMatches({ categories: ["event"] })).toEqual({
      kind: "topOfDeckFaceup",
      player: you,
      matches: { categories: ["event"] },
    });
  });
});

describe("§3.50 'the top card of your deck has a [type] or [wild] resource icon'", () => {
  it("topOfYourDeckHas names the type and the wild, on the faceup top card only", () => {
    expect(topOfYourDeckHas("physical")).toEqual({
      kind: "topOfDeckFaceup",
      player: you,
      matches: { anyPrintedResource: ["physical", "wild"] },
    });
    expect(topOfYourDeckHas("mental")).toEqual(topOfDeckMatches({ anyPrintedResource: ["mental", "wild"] }));
    expect(topOfYourDeckHas("energy")).toEqual(topOfDeckMatches({ anyPrintedResource: ["energy", "wild"] }));
    expect(validateDefinition(action(draw, ifThen(topOfYourDeckHas("energy"), draw)))).toEqual([]);
  });
});
