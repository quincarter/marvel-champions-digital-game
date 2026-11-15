import { describe, expect, it } from "vitest";
import { isPublished, publishedOnly } from "./published.js";

describe("isPublished", () => {
  it("counts GitHub's latest release and every older one", () => {
    expect(isPublished("v0.45.0", "v0.45.0")).toBe(true);
    expect(isPublished("v0.44.0", "v0.45.0")).toBe(true);
    expect(isPublished("v0.9.9", "v0.45.0")).toBe(true);
  });

  it("holds back a release newer than GitHub's latest, by number rather than by text", () => {
    expect(isPublished("v0.45.0", "v0.44.0")).toBe(false);
    expect(isPublished("v0.44.1", "v0.44.0")).toBe(false);
    expect(isPublished("v0.100.0", "v0.99.0")).toBe(false);
    expect(isPublished("v1.0.0", "v0.99.9")).toBe(false);
  });

  it("shows everything when there is no latest tag to go by", () => {
    expect(isPublished("v0.45.0", null)).toBe(true);
    expect(isPublished("v0.45.0", undefined)).toBe(true);
    expect(isPublished("v0.45.0", "nightly")).toBe(true);
  });
});

describe("publishedOnly", () => {
  it("drops the releases GitHub hasn't published yet and keeps the order", () => {
    const feed = [{ version: "v0.45.0" }, { version: "v0.44.0" }, { version: "v0.43.2" }];
    expect(publishedOnly(feed, "v0.44.0")).toEqual([{ version: "v0.44.0" }, { version: "v0.43.2" }]);
    expect(publishedOnly(feed, "v0.45.0")).toEqual(feed);
  });
});
