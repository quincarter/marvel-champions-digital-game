import { describe, expect, it } from "vitest";
import { readyVersionOf, steamUpdateViewOf, updateFailedAfterQuit, type SteamUpdateStatus } from "./steam-update.js";

const running = (log: string): SteamUpdateStatus => ({ running: true, exitCode: null, log });
const exited = (exitCode: number, log: string): SteamUpdateStatus => ({ running: false, exitCode, log });

describe("the update panel", () => {
  it("asks first, and ignores the log of an earlier run until the update has started", () => {
    const view = steamUpdateViewOf(exited(0, "MC_UPDATE done 1.0.0\n"), false, "1.1.0");
    expect(view.phase).toBe("ask");
    expect(view.body).toContain("version 1.1.0");
    expect(steamUpdateViewOf(null, true, null).body).toContain("the latest version");
  });

  it("follows curl's progress while it downloads", () => {
    const log = "Downloading version 1.1.0...\n\r###  12.5%\r#######  48.2%";
    const view = steamUpdateViewOf(running(log), true, "1.1.0");
    expect(view).toMatchObject({ phase: "working", heading: "Downloading version 1.1.0", percent: 48.2 });
    expect(steamUpdateViewOf(running(""), true, "1.1.0").percent).toBeNull();
  });

  it("is ready when the script waits for the game to quit, and says the version", () => {
    const view = steamUpdateViewOf(running("###  100.0%\nMC_UPDATE ready 1.1.0\n"), true, null);
    expect(view.phase).toBe("ready");
    expect(view.body).toContain("Version 1.1.0");
  });

  it("is not ready once the script waiting has gone", () => {
    const log = "MC_UPDATE ready 1.1.0\n";
    expect(steamUpdateViewOf({ running: false, exitCode: null, log }, true, null).phase).toBe("failed");
  });

  it("reads line ends from any system", () => {
    expect(steamUpdateViewOf(running("MC_UPDATE ready 1.1.0\r\n"), true, null).phase).toBe("ready");
    expect(steamUpdateViewOf(exited(1, "Error: the download failed.\r\n"), true, null).body).toContain(
      "The download failed. The game is unchanged.",
    );
  });

  it("says when there is nothing to update", () => {
    expect(steamUpdateViewOf(exited(0, "MC_UPDATE current 1.1.0\n"), true, null)).toMatchObject({
      phase: "current",
      body: "Version 1.1.0 is the latest.",
    });
  });

  it("says what stopped a failed update, and where its output is", () => {
    const view = steamUpdateViewOf(exited(1, "Error: couldn't find the latest release on GitHub.\n"), true, "1.1.0");
    expect(view.phase).toBe("failed");
    expect(view.body).toContain("Couldn't find the latest release on GitHub.");
    expect(view.body).toContain("~/.marvel-champions/update.log");
  });

  it("calls a script that ended with no report a failure", () => {
    expect(steamUpdateViewOf(exited(0, ""), true, null).phase).toBe("failed");
    expect(steamUpdateViewOf({ running: false, exitCode: null, log: "" }, true, null).body).toContain(
      "The script stopped before it finished.",
    );
  });

  describe("for an install from the release's installers (#843)", () => {
    it("asks, downloads, then says the game has been updated and to restart", () => {
      expect(steamUpdateViewOf(null, false, "1.1.0", "installer")).toMatchObject({
        phase: "ask",
        heading: "Update the game",
      });
      expect(steamUpdateViewOf(null, false, "1.1.0", "installer").body).toContain("version 1.1.0");
      expect(steamUpdateViewOf(null, false, "1.1.0", "installer-admin").body).toContain("administrator");
      expect(steamUpdateViewOf(running("###  30.0%"), true, "1.1.0", "installer")).toMatchObject({
        phase: "working",
        heading: "Downloading version 1.1.0",
        percent: 30,
      });
      expect(steamUpdateViewOf(running("MC_UPDATE ready 1.1.0\n"), true, "1.1.0", "installer")).toMatchObject({
        phase: "ready",
        heading: "The game has been updated",
        body: "Restart to apply version 1.1.0. The game closes, installs it and starts again.",
      });
    });

    it("fails the way the script's update does", () => {
      const view = steamUpdateViewOf(exited(1, "Error: the download failed.\n"), true, "1.1.0", "installer");
      expect(view.phase).toBe("failed");
      expect(view.body).toContain("The download failed.");
    });
  });
});

describe("a finished download waiting to install", () => {
  it("is the version the running update is ready with", () => {
    expect(readyVersionOf(running("###  100.0%\nMC_UPDATE ready 1.1.0\n"))).toBe("1.1.0");
    expect(readyVersionOf(running("###  50.0%"))).toBeNull();
    expect(readyVersionOf({ running: false, exitCode: null, log: "MC_UPDATE ready 1.1.0\n" })).toBeNull();
    expect(readyVersionOf(null)).toBeNull();
  });
});

describe("an update that didn't install after the game quit", () => {
  it("is one whose updater ended on a failed report", () => {
    const log = (text: string) => ({ running: false, exitCode: 1, log: text });
    const failed = "MC_UPDATE ready 1.1.0\nError: the installer stopped with code 5.\nMC_UPDATE failed 1.1.0\n";
    expect(updateFailedAfterQuit(log(failed))).toBe(true);
    // Only the end of the log reaches the game: a package manager's long output pushes `ready` out of it.
    const longInstall = `${"Setting up a package...\n".repeat(400)}Error: post-install failed.\nMC_UPDATE failed 1.1.0\n`;
    expect(updateFailedAfterQuit(log(longInstall.slice(-4096)))).toBe(true);
    // Failed while downloading, installed, still running, or nothing at all.
    expect(updateFailedAfterQuit(log("Error: the download failed.\n"))).toBe(false);
    expect(updateFailedAfterQuit(log("MC_UPDATE ready 1.1.0\nMC_UPDATE done 1.1.0\n"))).toBe(false);
    expect(updateFailedAfterQuit(running("MC_UPDATE ready 1.1.0\n"))).toBe(false);
    expect(updateFailedAfterQuit(null)).toBe(false);
  });
});

describe("Add to Steam (#844)", () => {
  it("asks, works, and says the game is in Steam once the script reports it added", () => {
    expect(steamUpdateViewOf(null, false, null, "add-steam")).toMatchObject({ phase: "ask", heading: "Add to Steam" });
    expect(steamUpdateViewOf(running("Closing Steam...\n"), true, null, "add-steam")).toMatchObject({
      phase: "working",
      percent: null,
    });
    expect(steamUpdateViewOf(exited(0, "Done.\nMC_UPDATE added 0.50.0\n"), true, null, "add-steam")).toMatchObject({
      phase: "done",
      heading: "Added to Steam",
    });
  });

  it("says why it stopped", () => {
    const view = steamUpdateViewOf(exited(1, "Error: Steam didn't close within a minute.\n"), true, null, "add-steam");
    expect(view).toMatchObject({ phase: "failed", heading: "The game wasn't added" });
    expect(view.body).toContain("Steam didn't close within a minute.");
  });
});
