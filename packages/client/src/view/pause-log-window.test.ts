import { describe, expect, test } from "vitest";
import type { LogLine } from "./log-lines.js";
import { logLineWords } from "./pause-log-window.js";

function line(id: string, round: number, text: string): LogLine {
  return { id, ref: `R${round}.1`, round, text, tags: [], voice: "player" };
}

describe("logLineWords", () => {
  test("appends each status tag so the list reads like the board's chips", () => {
    const base = line("1", 1, "Rhino is");
    expect(logLineWords({ ...base, tags: [{ status: "tough", spent: false }] })).toBe("Rhino is TOUGH");
    expect(logLineWords({ ...base, text: "Wolverine lost", tags: [{ status: "stunned", spent: true }] })).toBe(
      "Wolverine lost STUNNED",
    );
  });

  test("a line with no tags is its sentence", () => {
    expect(logLineWords(line("1", 1, "Round 2 begins."))).toBe("Round 2 begins.");
  });
});
