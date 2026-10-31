import { describe, expect, it } from "vitest";
import { steamUpdateViewOf, type SteamUpdateStatus } from "./steam-update.js";

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
});
