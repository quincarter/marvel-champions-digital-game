import { describe, expect, it } from "vitest";
import { ASPECT_GUIDES } from "../guide/aspects.js";
import { aspectTipContentOf } from "./aspect-tip-model.js";

describe("aspectTipContentOf", () => {
  it("returns the matching AspectGuide's own name, tagline and tip line for every guided aspect, with a live link for every playable aspect", () => {
    for (const guide of ASPECT_GUIDES) {
      const content = aspectTipContentOf(guide.aspect);
      const linkAvailable = guide.aspect !== "basic";
      expect(content).toEqual({
        aspect: guide.aspect,
        title: guide.name,
        tagline: guide.tagline,
        tipLine: guide.tipLine,
        linkLabel: "Aspects ▸",
        linkAvailable,
        linkReason: linkAvailable ? null : "Coming soon",
      });
    }
  });

  it("is null for 'pool', which has no AspectGuide yet", () => {
    expect(aspectTipContentOf("pool")).toBeNull();
  });

  it("Basic's own tip has no lesson to link to", () => {
    const content = aspectTipContentOf("basic");
    expect(content?.linkAvailable).toBe(false);
    expect(content?.linkReason).toBe("Coming soon");
  });

  it("every playable aspect's link is available", () => {
    for (const guide of ASPECT_GUIDES) {
      if (guide.aspect === "basic") continue;
      const content = aspectTipContentOf(guide.aspect);
      expect(content?.linkAvailable).toBe(true);
      expect(content?.linkReason).toBeNull();
    }
  });
});
