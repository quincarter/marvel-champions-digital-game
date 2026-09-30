/**
 * `view/dotted-word-hint.ts` — the D02 "Hover/Tap any dotted word for its rule" hint (guided mode design polish,
 * `docs/guided-mode.md` §4 G8's "in flight" note).
 */
import { describe, expect, test } from "vitest";
import { bodyHasGlossaryTerm, calloutFitsDottedWordHint, dottedWordHintFor } from "./dotted-word-hint.js";

describe("bodyHasGlossaryTerm", () => {
  test("true for a body with a [[term]]", () => {
    expect(bodyHasGlossaryTerm("Every villain phase he adds [[threat]] to it.")).toBe(true);
  });

  test("true for a body with a [[id|label]] term", () => {
    expect(bodyHasGlossaryTerm("Then it's [[exhausted|exhausted]].")).toBe(true);
  });

  test("false for plain body text", () => {
    expect(bodyHasGlossaryTerm("Cost is a number; pay with resources from any source.")).toBe(false);
  });
});

describe("dottedWordHintFor", () => {
  test("null when the body has no glossary term", () => {
    expect(dottedWordHintFor("Nothing dotted here.", false)).toBeNull();
    expect(dottedWordHintFor("Nothing dotted here.", true)).toBeNull();
  });

  test("pointer wording for a non-touch device", () => {
    expect(dottedWordHintFor("Watch the [[threat]].", false)).toBe("Hover any dotted word for its rule");
  });

  test("touch wording for a touch device", () => {
    expect(dottedWordHintFor("Watch the [[threat]].", true)).toBe("Tap any dotted word for its rule");
  });
});

describe("calloutFitsDottedWordHint", () => {
  test("fits with no buttons, one button, or neither combination filled", () => {
    expect(calloutFitsDottedWordHint(false, false)).toBe(true);
    expect(calloutFitsDottedWordHint(true, false)).toBe(true);
    expect(calloutFitsDottedWordHint(false, true)).toBe(true);
  });

  test("doesn't fit once both a secondary and a primary button are shown", () => {
    expect(calloutFitsDottedWordHint(true, true)).toBe(false);
  });
});
