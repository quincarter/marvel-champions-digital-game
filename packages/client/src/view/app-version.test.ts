import { describe, expect, test } from "vitest";
import { appVersionText, buildCommit, releaseNotesUrl, updateActions } from "./app-version.js";

describe("appVersionText", () => {
  test("the web build carries its commit, since it runs ahead of the last release", () => {
    expect(appVersionText("0.7.0", "web", "a1b2c3d")).toBe("v0.7.0+a1b2c3d");
  });

  test("a native app is exactly its release", () => {
    expect(appVersionText("0.7.0", "tauri", "a1b2c3d")).toBe("v0.7.0");
    expect(appVersionText("0.7.0", "capacitor", "a1b2c3d")).toBe("v0.7.0");
  });

  test("a build in another card language names it", () => {
    expect(appVersionText("0.7.0", "tauri", "a1b2c3d", "es")).toBe("v0.7.0 · ES");
    expect(appVersionText("0.7.0", "web", "a1b2c3d", "es")).toBe("v0.7.0+a1b2c3d · ES");
    expect(appVersionText("0.7.0", "tauri", "a1b2c3d", "en")).toBe("v0.7.0");
  });

  test("no commit known: the release alone", () => {
    expect(appVersionText("0.7.0", "web", "")).toBe("v0.7.0");
  });

  test("a test run has no build commit", () => {
    expect(buildCommit()).toBe("");
  });

  test("the release notes link is the release's own GitHub page", () => {
    expect(releaseNotesUrl("0.7.0")).toBe(
      "https://github.com/quincarter/marvel-champions-digital-game/releases/tag/v0.7.0",
    );
  });
});

describe("updateActions", () => {
  test("the changelog, then this install's own installer", () => {
    expect(updateActions({ downloadUrl: "https://x/app.apk", notesUrl: "https://x/notes" })).toEqual([
      { id: "update-notes", label: "What's new ↗", url: "https://x/notes" },
      { id: "update-download", label: "Download ↗", url: "https://x/app.apk" },
    ]);
  });

  test("one button to the release page when the installer isn't known", () => {
    expect(updateActions({ downloadUrl: null, notesUrl: "https://x/notes" })).toEqual([
      { id: "update-notes", label: "View release ↗", url: "https://x/notes" },
    ]);
  });
});
