/**
 * "Report an issue" (#176): what the report panel (`scenes/report-issue.ts`) copies, downloads and links to, as plain
 * data so it can be tested without a browser.
 *
 * The log is one text file a player can paste into an issue or attach to it: who and where (build, device, screen),
 * what happened (the game's own log lines, as the Board's log panel reads them), enough to replay the game exactly
 * (the setup and every command, which with the seed reproduce it), and the Ctrl+Shift+D debug snapshot
 * (`ui/debug-dump.ts`) for the bugs a refresh erases.
 *
 * The GitHub link carries only the short environment block: a URL has a length limit and a full game's commands do
 * not fit, so the issue template asks the player to paste or attach the log instead.
 */
import type { LogLine } from "./log-lines.js";
import { logLineWords } from "./pause-log-window.js";

export const ISSUE_REPO = "quincarter/marvel-champions-digital-game";

/** Where the player is and what they are running, as the report's header and the issue's environment block. */
export interface ReportEnvironment {
  /** `v0.21.1+9211646` (`view/app-version.ts`). */
  readonly version: string;
  readonly platform: string;
  readonly userAgent: string;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly formFactor: string;
  /** The screens and overlays running under the report panel, bottom first. */
  readonly screens: readonly string[];
  /** ISO time the report was made. */
  readonly at: string;
}

export interface ReportGame {
  readonly seed: number | string | null;
  readonly round: number | null;
  /** The engine's `GameStep`, written as JSON. */
  readonly step: unknown;
  readonly lines: readonly LogLine[];
  /** The setup the game started from (`SessionStore.state.config`). */
  readonly config: unknown;
  /** Every command dispatched since the game started or resumed, in order. */
  readonly commands: readonly unknown[];
}

export interface ReportInput {
  readonly environment: ReportEnvironment;
  /** Null when no game is running (Title, Decks, a campaign screen). */
  readonly game: ReportGame | null;
  readonly snapshot: unknown;
}

function environmentLines(environment: ReportEnvironment): string[] {
  return [
    `Version: ${environment.version}`,
    `Platform: ${environment.platform} (${environment.formFactor}, ${environment.viewport.width}x${environment.viewport.height})`,
    `Screen: ${environment.screens.length > 0 ? environment.screens.join(" > ") : "unknown"}`,
    `Browser: ${environment.userAgent}`,
    `Reported: ${environment.at}`,
  ];
}

/** The whole log file, as copied to the clipboard or saved. */
export function issueReportText(input: ReportInput): string {
  const sections: string[] = [
    "Marvel Champions: Digital Edition issue report",
    "",
    ...environmentLines(input.environment),
  ];
  const { game } = input;
  if (game === null) {
    sections.push("", "No game in progress.");
  } else {
    sections.push(
      "",
      "== Game ==",
      `Seed: ${game.seed ?? "unknown"}`,
      `Round: ${game.round ?? "unknown"}`,
      `Step: ${game.step == null ? "unknown" : JSON.stringify(game.step)}`,
      "",
      "== Game log (oldest first) ==",
      ...(game.lines.length === 0 ? ["(empty)"] : game.lines.map((line) => `${line.ref}  ${logLineWords(line)}`)),
      "",
      "== Replay (setup and commands) ==",
      JSON.stringify({ config: game.config, commands: game.commands }),
    );
  }
  sections.push("", "== Debug snapshot ==", JSON.stringify(input.snapshot, null, 2), "");
  return sections.join("\n");
}

/** `mc-report-2026-10-16-1209.txt`, in the player's own clock. */
export function issueReportFileName(at: Date): string {
  const two = (value: number): string => String(value).padStart(2, "0");
  const day = `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`;
  return `mc-report-${day}-${two(at.getHours())}${two(at.getMinutes())}.txt`;
}

/** A prefilled new-issue page: the environment, and room for what happened, the screenshot and the log. */
export function newIssueUrl(environment: ReportEnvironment): string {
  const body = [
    "**What happened?**",
    "",
    "",
    "**What did you expect to happen?**",
    "",
    "",
    "**Screenshot**",
    "Drag your screenshot here.",
    "",
    "**Log**",
    "Paste the copied log here, or drag in the downloaded `mc-report-….txt` file.",
    "",
    "**Environment**",
    ...environmentLines(environment).map((line) => `- ${line}`),
  ].join("\n");
  const query = new URLSearchParams({ title: "Bug: ", body, labels: "bug" });
  return `https://github.com/${ISSUE_REPO}/issues/new?${query.toString()}`;
}

export type ScreenshotDevice = "android" | "ios" | "mac" | "windows" | "other";

export function screenshotDeviceOf(userAgent: string): ScreenshotDevice {
  if (/Android/i.test(userAgent)) return "android";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "mac";
  if (/Windows/i.test(userAgent)) return "windows";
  return "other";
}

/** How to take a screenshot on this device, as the panel's first step says it. */
export function screenshotTipOf(device: ScreenshotDevice): string {
  switch (device) {
    case "android":
      return "Press Power and Volume down together.";
    case "ios":
      return "Press the side button and Volume up together.";
    case "mac":
      return "Press Cmd + Shift + 4, then drag over the game.";
    case "windows":
      return "Press Win + Shift + S, then drag over the game.";
    case "other":
      return "Use your device's screenshot shortcut.";
  }
}
