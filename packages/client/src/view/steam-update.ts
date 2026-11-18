/**
 * What the update panel (`scenes/steam-update.ts`) says, from the update's output: the Install for Steam script's, or
 * the game's own updater's for an install from the release's installers (issue #843, `src-tauri/src/self_update.rs`).
 * Both report by printing `MC_UPDATE <state> <version>` lines (scripts/<os>/install-for-steam.*,
 * scripts/update/update-game.*), curl prints its progress, and `Error:` opens the line a failure ends on.
 */
import { t } from "../i18n/translate.js";

/** The shell's answer (`src-tauri/src/steam_install.rs`). */
export interface SteamUpdateStatus {
  readonly running: boolean;
  /** Null while running, and when no update has run or the script was killed. */
  readonly exitCode: number | null;
  /** The end of the script's output. */
  readonly log: string;
}

/**
 * Who runs the update: the Install for Steam script, which installs once the player quits and leaves starting the game
 * again to Steam, or the game's own updater, which starts the game again itself. `installer-admin` is the per-machine
 * .msi or a Linux .deb or .rpm, which the system asks an administrator's permission to install.
 */
export type UpdateMode = "steam" | "installer" | "installer-admin";

export type SteamUpdatePhase = "ask" | "working" | "ready" | "current" | "done" | "failed";

export interface SteamUpdateView {
  readonly phase: SteamUpdatePhase;
  readonly heading: string;
  readonly body: string;
  /** How far the download is, 0 to 100, once curl says. */
  readonly percent: number | null;
}

/**
 * Emitted on the game's event bus when the panel closes. The panel is loaded on first use (`scenes/scene-table.ts`), so a
 * screen that opened it can't reach its scene to listen to its own shutdown; it listens for this instead.
 */
export const STEAM_UPDATE_CLOSED = "steam-update-closed";

/** The Title footer and bug reports: how this install got here. */
export const STEAM_SCRIPT_TAG = "Steam script";

export const STEAM_INSTALL_ROW_TITLE = "Steam install";
export const STEAM_INSTALL_ROW_DETAIL = "Installed by the Steam script. Run it again to get the latest version.";

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

function installerAskView(version: string | null, msi: boolean): SteamUpdateView {
  return {
    phase: "ask",
    heading: t("update.ask.heading"),
    body: t(msi ? "update.ask.bodyAdmin" : "update.ask.body", { version: version ?? "" }),
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
  mode: UpdateMode = "steam",
): SteamUpdateView {
  const installer = mode !== "steam";
  if (!started || status === null)
    return installer ? installerAskView(version, mode === "installer-admin") : askView(version);
  const report = lastReport(status.log);
  // Ready means the script is waiting; one that has gone since (killed, or stopped) is waiting for nothing.
  if (report?.state === "ready" && status.running) {
    if (installer) {
      return {
        phase: "ready",
        heading: t("update.ready.heading"),
        body: t("update.ready.body", { version: report.version }),
        percent: null,
      };
    }
    return {
      phase: "ready",
      heading: "Ready to install",
      body: `Version ${report.version} is downloaded. Quit the game to install it, then give it a minute before you start the game again. You can keep playing: it installs whenever you quit.`,
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
  if (status.running && installer && version !== null) {
    return {
      phase: "working",
      heading: t("update.working.heading", { version }),
      body: t("update.working.body"),
      percent: lastPercent(status.log),
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

/**
 * The version a finished download is waiting to install, or null: the update is still running and its last report is
 * `ready`. The Title's "The game has been updated" banner reads it, so it shows after the panel is closed too.
 */
export function readyVersionOf(status: SteamUpdateStatus | null): string | null {
  if (status === null || !status.running) return null;
  const report = lastReport(status.log);
  return report?.state === "ready" ? report.version : null;
}

/**
 * Whether the last update was downloaded and the game quit for it, but it didn't install: the updater started the old
 * game again, ending its log with `MC_UPDATE failed <version>` (scripts/update/update-game.*). That report comes last,
 * so it is in the end of the log the shell returns however much an installer printed before it. The Title's update
 * banner says so on the next launch, since the game wasn't running to show the panel.
 */
export function updateFailedAfterQuit(status: SteamUpdateStatus | null): boolean {
  if (status === null || status.running) return false;
  return lastReport(status.log)?.state === "failed";
}
