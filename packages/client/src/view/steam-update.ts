/**
 * What the update panel (`scenes/steam-update.ts`) says, from the Install for Steam script's output. The script reports
 * by printing `MC_UPDATE <state> <version>` lines (scripts/<os>/install-for-steam.*), curl prints its progress, and
 * `Error:` opens the line a failure ends on.
 */

/** The shell's answer (`src-tauri/src/steam_install.rs`). */
export interface SteamUpdateStatus {
  readonly running: boolean;
  /** Null while running, and when no update has run or the script was killed. */
  readonly exitCode: number | null;
  /** The end of the script's output. */
  readonly log: string;
}

export type SteamUpdatePhase = "ask" | "working" | "ready" | "current" | "done" | "failed";

export interface SteamUpdateView {
  readonly phase: SteamUpdatePhase;
  readonly heading: string;
  readonly body: string;
  /** How far the download is, 0 to 100, once curl says. */
  readonly percent: number | null;
}

/** The Title footer and bug reports: how this install got here. */
export const STEAM_SCRIPT_TAG = "Steam script";

export const STEAM_INSTALL_ROW_TITLE = "Steam install";
export const STEAM_INSTALL_ROW_DETAIL =
  "Installed by the Install for Steam script. Run it again to get the latest version.";

const LOG_PATH = "~/.marvel-champions/update.log";

function askView(version: string | null): SteamUpdateView {
  return {
    phase: "ask",
    heading: "Update the game",
    body:
      `The Install for Steam script installed this game, so it can update it too. It downloads ` +
      `${version === null ? "the latest version" : `version ${version}`}, then asks you to quit so it can replace the ` +
      `game. Your saves, Steam entry and play time stay as they are.`,
    percent: null,
  };
}

/** The last thing the script said it had reached, with its version. */
function lastReport(log: string): { readonly state: string; readonly version: string } | null {
  const reports = [...log.matchAll(/^MC_UPDATE (\w+) (\S+)\s*$/gm)];
  const last = reports.at(-1);
  return last === undefined ? null : { state: last[1]!, version: last[2]! };
}

/** curl's progress bar rewrites one line ending in the percent so far. */
function lastPercent(log: string): number | null {
  const last = [...log.matchAll(/(\d{1,3}(?:\.\d)?)%/g)].at(-1);
  return last === undefined ? null : Math.min(100, Number(last[1]));
}

function failureOf(log: string): string {
  const line = [...log.matchAll(/^Error: (.+?)\s*$/gm)].at(-1)?.[1];
  return line === undefined ? "The script stopped before it finished." : `${line[0]!.toUpperCase()}${line.slice(1)}`;
}

/**
 * Where the update stands. `started` is false until the shell has started it, so the log of an earlier run isn't taken
 * for this one's (the shell starts a new log each time).
 */
export function steamUpdateViewOf(
  status: SteamUpdateStatus | null,
  started: boolean,
  version: string | null,
): SteamUpdateView {
  if (!started || status === null) return askView(version);
  const report = lastReport(status.log);
  // Ready means the script is waiting; one that has gone since (killed, or stopped) is waiting for nothing.
  if (report?.state === "ready" && status.running) {
    return {
      phase: "ready",
      heading: "Ready to install",
      body: `Version ${report.version} is downloaded. Quit the game to install it, then start the game again. You can keep playing: it installs whenever you quit.`,
      percent: null,
    };
  }
  if (report?.state === "current") {
    return { phase: "current", heading: "Up to date", body: `Version ${report.version} is the latest.`, percent: null };
  }
  if (report?.state === "done") {
    return {
      phase: "done",
      heading: "Updated",
      body: `Version ${report.version} is installed. Quit and start the game again to play it.`,
      percent: null,
    };
  }
  if (status.running) {
    return {
      phase: "working",
      heading: version === null ? "Updating" : `Downloading version ${version}`,
      body: "You can close this and keep playing while it downloads. Stay in the game until it's done.",
      percent: lastPercent(status.log),
    };
  }
  return {
    phase: "failed",
    heading: "The update didn't finish",
    body: `${failureOf(status.log)} The game is unchanged. The script's output is in ${LOG_PATH}.`,
    percent: null,
  };
}
