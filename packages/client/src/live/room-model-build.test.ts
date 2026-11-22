import { describe, expect, it } from "vitest";
import { buildGapOf, sameBuild } from "./room-model.js";

const host = { appVersion: "1.2.3", contentVersion: "c1", rules: "aaaa" };

describe("sameBuild", () => {
  it("needs equal rules when both sides send one", () => {
    expect(sameBuild(host, { ...host })).toBe(true);
    expect(sameBuild({ ...host, rules: "bbbb" }, host)).toBe(false);
  });
  it("falls back to the versions when either side sends no rules", () => {
    expect(sameBuild({ appVersion: "1.2.3", contentVersion: "c1" }, host)).toBe(true);
    expect(sameBuild(host, { appVersion: "1.2.3", contentVersion: "c1" })).toBe(true);
    expect(sameBuild({ ...host, rules: "" }, { ...host, rules: "bbbb" })).toBe(true);
    expect(sameBuild({ appVersion: "1.2.2", contentVersion: "c1" }, host)).toBe(false);
  });
});

describe("buildGapOf", () => {
  it("names who is behind, or the same version on another build", () => {
    expect(buildGapOf({ ...host }, host)).toBeNull();
    expect(buildGapOf({ ...host, appVersion: "1.2.2" }, host)).toBe("hostNewer");
    expect(buildGapOf({ ...host, appVersion: "1.3.0" }, host)).toBe("hostOlder");
    expect(buildGapOf({ ...host, rules: "bbbb" }, host)).toBe("rules");
    expect(buildGapOf({ ...host, contentVersion: "c2" }, host)).toBe("rules");
    expect(buildGapOf({ ...host, appVersion: "dev" }, host)).toBe("other");
    // An older room's settings may carry no version at all.
    expect(buildGapOf({ ...host, appVersion: undefined as unknown as string }, host)).toBe("other");
  });
});
