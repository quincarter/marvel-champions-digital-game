import { describe, expect, it } from "vitest";
import { creatorsIn } from "./mod-store-browse.js";
import type { ModStoreTile } from "./mod-store-model.js";
import { galleryHeadingOf, packBodyOf, packStatusOf, packTitleOf } from "./mod-store-detail-model.js";

const tile: ModStoreTile = {
  creators: creatorsIn("Bo"),
  id: "x",
  name: "X",
  creator: "Bo",
  kind: "hero",
  kindLabel: "Hero pack",
  summary: "",
  state: "update",
  stateLabel: "Update",
  version: "1.1.0",
  size: "1 MB",
  installed: true,
  thumbnail: undefined,
  latest: "1.1.0",
  cover: undefined,
  previewUrl: undefined,
  baseUrl: undefined,
  reason: undefined,
  inCatalog: true,
  tags: [],
  approved: undefined,
};

describe("packStatusOf", () => {
  const none = { running: null, removeError: null, requirement: undefined };

  it("is empty with nothing to say", () => {
    expect(packStatusOf(none)).toEqual({ kind: "none" });
  });

  it("says the requirement a pack waits on", () => {
    expect(packStatusOf({ ...none, requirement: "Needs 0.9." })).toEqual({ kind: "requirement", text: "Needs 0.9." });
  });

  it("says an install's failure before a removal's, and either before the requirement", () => {
    expect(packStatusOf({ ...none, running: { error: "Failed.", progress: null }, removeError: "Other" })).toEqual({
      kind: "failure",
      text: "Failed.",
    });
    expect(packStatusOf({ ...none, removeError: "Other", requirement: "Needs 0.9." })).toEqual({
      kind: "failure",
      text: "Other",
    });
  });

  it("says it is starting before the first report, then how far the install is", () => {
    expect(packStatusOf({ ...none, running: { error: null, progress: null } })).toEqual({
      kind: "progress",
      text: "Starting",
      fraction: 0,
    });
    const going = packStatusOf({
      ...none,
      running: { error: null, progress: { phase: "download", done: 1, total: 4 } as never },
    });
    expect(going.kind).toBe("progress");
  });
});

describe("packTitleOf", () => {
  it("carries the page's words and the state chip, which says Retry update for a failed update", () => {
    const page = { title: "X", byline: "by Bo", meta: "Hero pack · v1.1.0 · 1 MB", body: "", requirement: undefined };
    expect(packTitleOf(tile, page, false)).toEqual({
      name: "X",
      byline: "by Bo",
      meta: "Hero pack · v1.1.0 · 1 MB",
      chip: "↑ Update",
      solid: true,
    });
    expect(packTitleOf(tile, page, true).chip).toBe("! Retry update");
  });
});

describe("packBodyOf", () => {
  it("leads with the load status when the pack is installed", () => {
    expect(packBodyOf(null, "About X.")).toBe("About X.");
    expect(packBodyOf({ state: "loaded", label: "Loaded", detail: "It works." }, "About X.")).toBe(
      "Loaded. It works.\n\nAbout X.",
    );
  });
});

describe("galleryHeadingOf", () => {
  it("counts the cards, and says when they are a preview of a pack that is not installed", () => {
    expect(galleryHeadingOf(true, 9)).toBe("CARDS  ·  9 cards");
    expect(galleryHeadingOf(false, 1)).toBe("CARDS  ·  PREVIEW, NOT INSTALLED  ·  1 card");
  });
});
