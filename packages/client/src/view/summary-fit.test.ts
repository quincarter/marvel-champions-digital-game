import { describe, expect, test } from "vitest";
import { summaryWithin } from "./summary-fit.js";

/** 20 characters to a line, breaking on spaces. */
const linesOf = (text: string): number => {
  let lines = 1;
  let len = 0;
  for (const word of text.split(/\s+/)) {
    const needed = len === 0 ? word.length : len + 1 + word.length;
    if (needed > 20 && len > 0) {
      lines += 1;
      len = word.length;
    } else len = needed;
  }
  return lines;
};

describe("summaryWithin", () => {
  test("a summary that fits is left alone", () => {
    expect(summaryWithin("Each minion gains guard.", 2, linesOf)).toBe("Each minion gains guard.");
  });
  test("ends at the last whole sentence that fits", () => {
    expect(summaryWithin("Gains guard. The enemy leader gets +1 ATK while attacking.", 2, linesOf)).toBe(
      "Gains guard.",
    );
  });
  test("a first sentence that is too long is cut at a word with an ellipsis that fits", () => {
    const out = summaryWithin("When Revealed: The enemy team searches the encounter deck for minions.", 2, linesOf);
    expect(out.endsWith("…")).toBe(true);
    expect(linesOf(out)).toBeLessThanOrEqual(2);
    expect(out.startsWith("When Revealed: The enemy")).toBe(true);
    expect(out).not.toMatch(/\s…$/);
  });
});
