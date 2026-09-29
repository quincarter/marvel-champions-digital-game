import { describe, expect, it } from "vitest";
import { ASPECT_GUIDES } from "../guide/aspects.js";
import { aspectTipContentOf } from "./aspect-tip-model.js";

describe("aspectTipContentOf", () => {
  it("returns the matching AspectGuide's own name, tagline and tip line for every guided aspect", () => {
    for (const guide of ASPECT_GUIDES) {
      const content = aspectTipContentOf(guide.aspect);
      expect(content).toEqual({
        aspect: guide.aspect,
        title: guide.name,
        tagline: guide.tagline,
        tipLine: guide.tipLine,
        linkLabel: "Aspects ▸",
        linkAvailable: false,
        linkReason: "Coming soon",
      });
    }
  });

  it("is null for 'pool', which has no AspectGuide yet", () => {
    expect(aspectTipContentOf("pool")).toBeNull();
  });
});
