/**
 * Issue #791 (the owner, 2026-11-17): an exported log and an issue report of an adjusted game say so up top, so neither
 * is read as a game the rules played.
 */
import { describe, expect, test } from "vitest";
import { issueReportText, type ReportEnvironment } from "./issue-report.js";
import { ADJUSTED_LOG_LINE, logText } from "./log-export.js";

const environment: ReportEnvironment = {
  version: "v0.48.0",
  platform: "web",
  cardLanguage: "en",
  userAgent: "test",
  viewport: { width: 1280, height: 720 },
  formFactor: "desktop",
  screens: ["Board"],
  at: "2026-11-17T12:00:00.000Z",
};

const game = { seed: 7, round: 3, step: "heroPhase", lines: [], config: { seed: 7 }, commands: [] };
const heading = { game: "Rhino · Spider-Man", difficulty: "Standard", result: null, playedAt: 0 };

describe("the adjusted mark in exported logs and issue reports", () => {
  test("an adjusted game's log file says so under its heading", () => {
    const text = logText({ ...heading, adjusted: true }, []);
    expect(text.split("\n").slice(0, 4)).toContain(ADJUSTED_LOG_LINE);
  });

  test("an issue report of an adjusted game says so in its Game section", () => {
    const text = issueReportText({ environment, game: { ...game, adjusted: true }, snapshot: {} });
    expect(text.indexOf(ADJUSTED_LOG_LINE)).toBeGreaterThan(text.indexOf("== Game =="));
    expect(text.indexOf(ADJUSTED_LOG_LINE)).toBeLessThan(text.indexOf("== Game log"));
  });

  test("a game played by the rules carries no mark in either", () => {
    expect(logText(heading, [])).not.toContain("Adjusted:");
    expect(issueReportText({ environment, game, snapshot: {} })).not.toContain("Adjusted:");
  });
});
