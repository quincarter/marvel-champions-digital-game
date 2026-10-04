/**
 * docs/phase7-wave6.md §3.62: the DSL side of "choose 1 set-aside encounter set at random, reveal its SHOW environment
 * and …" (MojoMania 1B, `mojo` 39025b; Wheel of Genres, 39026a/b). `revealFromSetAsideModularSet` compiles to the
 * engine's `shuffleInSetAsideModularSet` with `reveal` and `placement`; `setAsideModularSetCount` asks whether a set is
 * left. The engine's `set-aside-modular-set-reveal.test.ts` drives the behavior.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { forcedInterrupt, forcedResponse, on, whenRevealed } from "./abilities.js";
import {
  dealEncounterCard,
  endGame,
  flipCard,
  ifThen,
  revealFromSetAsideModularSet,
  shuffleInSetAsideModularSet,
} from "./effects.js";
import { validateDefinition } from "./validate.js";
import { firstPlayer, query, self, setAsideModularSetCount, valueEquals } from "./values.js";

const SHOW = trait("SHOW");
const showEnvironment = query("environment", { trait: SHOW });

describe("§3.62 revealFromSetAsideModularSet", () => {
  it("compiles to shuffleInSetAsideModularSet with the reveal query; the placement and bind only when given", () => {
    expect(revealFromSetAsideModularSet(showEnvironment)).toEqual({
      kind: "shuffleInSetAsideModularSet",
      reveal: { categories: ["environment"], trait: "SHOW" },
    });
    expect(revealFromSetAsideModularSet(showEnvironment, { placement: "shuffledOnTop", bind: "set" })).toEqual({
      kind: "shuffleInSetAsideModularSet",
      bind: "set",
      reveal: { categories: ["environment"], trait: "SHOW" },
      placement: "shuffledOnTop",
    });
    // The Hood's builder is unchanged.
    expect(shuffleInSetAsideModularSet()).toEqual({ kind: "shuffleInSetAsideModularSet" });
  });

  it("MojoMania 1B: a When Revealed that reveals the SHOW and shuffles the rest in", () => {
    const definition = whenRevealed(revealFromSetAsideModularSet(showEnvironment));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([
      { kind: "shuffleInSetAsideModularSet", reveal: { categories: ["environment"], trait: "SHOW" } },
    ]);
  });

  it("Wheel of Genres, Stopped: the set on top, two cards to the first player, then the flip", () => {
    const definition = forcedInterrupt(
      on.villainStepStarting(),
      revealFromSetAsideModularSet(showEnvironment, { placement: "shuffledOnTop" }),
      dealEncounterCard(firstPlayer),
      dealEncounterCard(firstPlayer),
      flipCard(self),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects[0]).toEqual({
      kind: "shuffleInSetAsideModularSet",
      reveal: { categories: ["environment"], trait: "SHOW" },
      placement: "shuffledOnTop",
    });
  });

  it("Wheel of Genres, Spinning: no set-aside modular set remaining loses the game, otherwise it flips", () => {
    const definition = forcedResponse(
      on.encounterDeckResets(),
      ifThen(valueEquals(setAsideModularSetCount, 0), endGame("loss"), flipCard(self)),
    );
    expect(validateDefinition(definition)).toEqual([]);
  });

  it("a bind is in scope for the effects after it", () => {
    const definition = whenRevealed(
      revealFromSetAsideModularSet(showEnvironment, { bind: "set" }),
      ifThen(valueEquals({ kind: "var", name: "set.made" }, 0), endGame("loss")),
    );
    expect(validateDefinition(definition)).toEqual([]);
  });
});
