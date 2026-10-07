/**
 * docs/phase7-wave7.md §3.14, §3.34 item 2: "Flip this card and reveal it" / "flip this card and reveal [its other
 * face]" with `flipCard(target, { reveal: true })`, which compiles to the engine's `flipCard.reveal`. The engine's
 * `flip-reveal.test.ts` drives the behavior.
 */

import { describe, expect, it } from "vitest";
import { forcedInterrupt } from "./abilities.js";
import { flipCard } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { self } from "./values.js";

describe("§3.14 flipCard with a reveal", () => {
  it("a plain flip compiles as before, with no reveal field", () => {
    expect(flipCard(self)).toEqual({ kind: "flipCard", target: { kind: "self" } });
    expect(flipCard(self, { reveal: false })).toEqual({ kind: "flipCard", target: { kind: "self" } });
  });

  it("'flip this card and reveal it' carries the reveal", () => {
    expect(flipCard(self, { reveal: true })).toEqual({ kind: "flipCard", target: { kind: "self" }, reveal: true });
  });

  it("the shape validates inside a forced interrupt", () => {
    const definition = forcedInterrupt({ on: "characterDefeated" }, flipCard(self, { reveal: true }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([{ kind: "flipCard", target: { kind: "self" }, reveal: true }]);
  });
});
