import { describe, expect, it } from "vitest";
import { balancedLayoutOf } from "./campaign-balanced-layout.js";

// The shoot-app sizes: se 375x667, pixel 412x924, tablet-portrait 820x1180, tablet 1180x820, desktop 1440x980.
describe("the Balanced prompt's layout", () => {
  it.each([375, 412])("is one full-width column with the pane stacked below on a %i wide phone", (width) => {
    const layout = balancedLayoutOf(width, 16);
    expect(layout.kind).toBe("phone");
    expect(layout.pane).toBeNull();
    expect(layout.primary).toEqual({ x: 16, width: width - 32 });
    expect(layout.paneInner).toEqual(layout.primary);
  });

  it.each([768, 820, 1024, 1180, 1440, 1920])("splits the choice and a right-hand pane at %i wide", (width) => {
    const layout = balancedLayoutOf(width, 24);
    const pane = layout.pane!;
    expect(pane).not.toBeNull();
    expect(layout.primary.x).toBe(24);
    expect(layout.primary.x + layout.primary.width).toBeLessThan(pane.x);
    // The pane runs to the right edge, with its text inside it.
    expect(pane.x + pane.width).toBe(width);
    expect(layout.paneInner.x).toBeGreaterThan(pane.x);
    expect(layout.paneInner.x + layout.paneInner.width).toBeLessThanOrEqual(width);
    expect(layout.paneInner.width).toBeGreaterThanOrEqual(300);
    expect(layout.primary.width).toBeGreaterThanOrEqual(300);
  });

  it("calls a tablet in portrait a tablet and a tablet in landscape and the desktop wide", () => {
    expect(balancedLayoutOf(820, 24).kind).toBe("tablet");
    expect(balancedLayoutOf(1180, 24).kind).toBe("wide");
    expect(balancedLayoutOf(1440, 24).kind).toBe("wide");
  });

  it("caps the pane's text so lines stay readable on a big screen", () => {
    expect(balancedLayoutOf(1920, 24).paneInner.width).toBe(620);
  });

  it("keeps body text legible at every size", () => {
    for (const width of [375, 412, 820, 1180, 1440]) {
      expect(balancedLayoutOf(width, 16).textSize).toBeGreaterThanOrEqual(13);
    }
  });
});
