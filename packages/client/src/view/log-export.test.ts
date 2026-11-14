import { describe, expect, test } from "vitest";
import type { LogLine } from "./log-lines.js";
import { logText } from "./log-export.js";

const line = (ref: string, text: string, tags: LogLine["tags"] = []): LogLine => ({
  id: ref,
  ref,
  round: 1,
  text,
  tags,
  voice: "player",
});

describe("logText", () => {
  test("writes the heading, then each line under its aligned reference, statuses in words", () => {
    const text = logText(
      {
        game: "Rhino · Spider-Man",
        difficulty: "Standard",
        result: "Rhino defeated",
        playedAt: Date.UTC(2026, 10, 13),
      },
      [
        line("R1.1", "Spider-Man plays Web-Shooter."),
        line("R10.12", "Rhino is", [{ status: "stunned", spent: false }]),
      ],
    );
    expect(text).toBe(
      [
        "Marvel Champions: Rhino · Spider-Man (Standard)",
        "Result: Rhino defeated",
        "Played: 2026-11-13",
        "",
        "R1.1    Spider-Man plays Web-Shooter.",
        "R10.12  Rhino is stunned.",
        "",
      ].join("\n"),
    );
  });

  test("leaves out what isn't known", () => {
    expect(logText({ game: "Rhino", difficulty: null, result: null, playedAt: 0 }, []).split("\n")[0]).toBe(
      "Marvel Champions: Rhino",
    );
  });
});
