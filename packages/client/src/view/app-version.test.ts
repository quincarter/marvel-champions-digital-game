import { describe, expect, test } from "vitest";
import { appVersionText, buildCommit } from "./app-version.js";

describe("appVersionText", () => {
  test("the web build carries its commit, since it runs ahead of the last release", () => {
    expect(appVersionText("0.7.0", "web", "a1b2c3d")).toBe("v0.7.0+a1b2c3d");
  });

  test("a native app is exactly its release", () => {
    expect(appVersionText("0.7.0", "tauri", "a1b2c3d")).toBe("v0.7.0");
    expect(appVersionText("0.7.0", "capacitor", "a1b2c3d")).toBe("v0.7.0");
  });

  test("no commit known: the release alone", () => {
    expect(appVersionText("0.7.0", "web", "")).toBe("v0.7.0");
  });

  test("a test run has no build commit", () => {
    expect(buildCommit()).toBe("");
  });
});
