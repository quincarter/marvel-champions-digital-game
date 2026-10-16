import { describe, expect, test } from "vitest";
import {
  issueReportFileName,
  issueReportText,
  newIssueUrl,
  screenshotDeviceOf,
  screenshotTipOf,
  type ReportEnvironment,
} from "./issue-report.js";
import type { LogLine } from "./log-lines.js";

const environment: ReportEnvironment = {
  version: "v0.21.1+9211646",
  platform: "web",
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/129",
  viewport: { width: 390, height: 844 },
  formFactor: "phone",
  screens: ["Board", "ChoiceOverlay"],
  at: "2026-10-16T12:09:28.000Z",
};

const line = (ref: string, text: string, tags: LogLine["tags"] = []): LogLine => ({
  id: ref,
  ref,
  round: 1,
  text,
  tags,
  voice: "player",
});

describe("issueReportText", () => {
  test("outside a game: the environment, a note that no game is running, and the snapshot", () => {
    const text = issueReportText({ environment, game: null, snapshot: { frame: 12 } });
    expect(text).toContain("Version: v0.21.1+9211646");
    expect(text).toContain("Platform: web (phone, 390x844)");
    expect(text).toContain("Screen: Board > ChoiceOverlay");
    expect(text).toContain("No game in progress.");
    expect(text).not.toContain("== Game log");
    expect(text).toContain('"frame": 12');
  });

  test("in a game: the log lines oldest first with their status words, then the replay", () => {
    const text = issueReportText({
      environment,
      game: {
        seed: 83069,
        round: 2,
        step: "heroPhase",
        lines: [line("R1.1", "Spider-Man drew 5"), line("R1.2", "Rhino is", [{ status: "tough", spent: false }])],
        config: { seed: 83069 },
        commands: [{ kind: "mulligan" }],
      },
      snapshot: {},
    });
    expect(text).toContain("Seed: 83069");
    expect(text).toContain("Round: 2");
    expect(text.indexOf("R1.1  Spider-Man drew 5")).toBeLessThan(text.indexOf("R1.2  Rhino is TOUGH"));
    expect(text).toContain('{"config":{"seed":83069},"commands":[{"kind":"mulligan"}]}');
  });

  test("an empty game log says so", () => {
    const text = issueReportText({
      environment,
      game: { seed: null, round: null, step: null, lines: [], config: null, commands: [] },
      snapshot: {},
    });
    expect(text).toContain("Seed: unknown");
    expect(text).toContain("(empty)");
  });
});

test("the file name is the player's local date and time", () => {
  expect(issueReportFileName(new Date(2026, 9, 6, 8, 5))).toBe("mc-report-2026-10-06-0805.txt");
});

describe("newIssueUrl", () => {
  test("a new issue on this repo, labeled bug, with the environment in the body", () => {
    const url = new URL(newIssueUrl(environment));
    expect(url.origin + url.pathname).toBe("https://github.com/quincarter/marvel-champions-digital-game/issues/new");
    expect(url.searchParams.get("labels")).toBe("bug");
    expect(url.searchParams.get("title")).toBe("Bug: ");
    const body = url.searchParams.get("body") ?? "";
    expect(body).toContain("- Version: v0.21.1+9211646");
    expect(body).toContain("Drag your screenshot here.");
    expect(body).toContain("mc-report-");
  });

  test("short enough for GitHub to accept", () => {
    expect(newIssueUrl(environment).length).toBeLessThan(4000);
  });
});

describe("screenshot tips", () => {
  test.each([
    ["Mozilla/5.0 (Linux; Android 14; Pixel 8)", "android", "Power and Volume down"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", "ios", "side button"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)", "mac", "Cmd + Shift + 4"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "windows", "Win + Shift + S"],
    ["Mozilla/5.0 (X11; Linux x86_64)", "other", "screenshot shortcut"],
  ])("%s", (userAgent, device, tip) => {
    expect(screenshotDeviceOf(userAgent)).toBe(device);
    expect(screenshotTipOf(screenshotDeviceOf(userAgent))).toContain(tip);
  });
});
