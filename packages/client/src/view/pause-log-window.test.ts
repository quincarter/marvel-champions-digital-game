import { describe, expect, test } from "vitest";
import type { LogLine } from "./log-lines.js";
import { recentLogMoments } from "./pause-log-window.js";

function line(id: string, round: number, text: string): LogLine {
  return { id, ref: `R${round}.1`, round, text, tags: [], voice: "player" };
}

describe("recentLogMoments", () => {
  test("newest first", () => {
    const lines = [line("1", 1, "First thing."), line("2", 2, "Second thing."), line("3", 3, "Third thing.")];
    const moments = recentLogMoments(lines, 1000, 400);
    expect(moments.map((m) => m.line.id)).toEqual(["3", "2", "1"]);
  });

  test("stops once the next line would overflow the available height", () => {
    const lines = Array.from({ length: 20 }, (_unused, i) => line(`${i}`, i, `Line ${i}.`));
    const moments = recentLogMoments(lines, 60, 400);
    expect(moments.length).toBeGreaterThan(0);
    expect(moments.length).toBeLessThan(lines.length);
    const used = moments.reduce((sum, m) => sum + m.height, 0);
    expect(used).toBeLessThanOrEqual(60 + moments[moments.length - 1]!.height);
  });

  test("always shows at least the newest line, even if it alone doesn't fit", () => {
    const lines = [line("1", 1, "A very long sentence that will certainly wrap to several lines at a narrow width.")];
    const moments = recentLogMoments(lines, 1, 40);
    expect(moments).toHaveLength(1);
  });

  test("empty log: no moments", () => {
    expect(recentLogMoments([], 500, 400)).toHaveLength(0);
  });
});
