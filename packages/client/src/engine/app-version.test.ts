import { describe, expect, test } from "vitest";
import { compareVersions, isNewerVersion } from "./app-version.js";

describe("compareVersions", () => {
  test("compares major, minor and patch as numbers, not text", () => {
    expect(compareVersions("0.33.0", "0.33.0")).toBe(0);
    expect(compareVersions("0.34.0", "0.33.9")).toBe(1);
    expect(compareVersions("0.9.0", "0.33.0")).toBe(-1);
    expect(compareVersions("1.0.0", "0.99.99")).toBe(1);
    expect(compareVersions("0.33.10", "0.33.9")).toBe(1);
  });

  test("a missing part is zero, a leading v is allowed and build metadata is ignored", () => {
    expect(compareVersions("1.2", "1.2.0")).toBe(0);
    expect(compareVersions("v1.2.3", "1.2.3")).toBe(0);
    expect(compareVersions("1.2.3+abc", "1.2.3+def")).toBe(0);
  });

  test("a pre-release is before its release and ordered among its siblings", () => {
    expect(compareVersions("1.0.0-beta.1", "1.0.0")).toBe(-1);
    expect(compareVersions("1.0.0", "1.0.0-rc.1")).toBe(1);
    expect(compareVersions("1.0.0-beta.2", "1.0.0-beta.10")).toBe(-1);
    expect(compareVersions("1.0.0-alpha", "1.0.0-beta")).toBe(-1);
    expect(compareVersions("1.0.0-1", "1.0.0-alpha")).toBe(-1);
    expect(compareVersions("1.0.0-beta", "1.0.0-beta.1")).toBe(-1);
  });

  test("a version that does not parse compares as unknown", () => {
    expect(compareVersions("banana", "1.0.0")).toBeNull();
    expect(compareVersions("1.0.0", "")).toBeNull();
  });
});

describe("isNewerVersion", () => {
  test("is true only for a parsed, strictly newer version", () => {
    expect(isNewerVersion("0.34.0", "0.33.0")).toBe(true);
    expect(isNewerVersion("0.33.0", "0.33.0")).toBe(false);
    expect(isNewerVersion("0.32.0", "0.33.0")).toBe(false);
    expect(isNewerVersion(undefined, "0.33.0")).toBe(false);
    expect(isNewerVersion("nightly", "0.33.0")).toBe(false);
  });
});
