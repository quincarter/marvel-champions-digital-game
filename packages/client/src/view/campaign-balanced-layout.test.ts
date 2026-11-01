import { describe, expect, it } from "vitest";
import { balancedLayoutOf } from "./campaign-balanced-layout.js";

// The shoot-app sizes: se, pixel, tablet-portrait (768 and 820), tablet (1024 and 1180), desktop.
describe("the Balanced prompt's layout", () => {
  it.each([375, 412])("is one full-width column on a %i wide phone", (width) => {
    const layout = balancedLayoutOf(width, 16);
    expect(layout.kind).toBe("phone");
    expect(layout.secondary).toBeNull();
    expect(layout.primary).toEqual({ x: 16, width: width - 32 });
  });

  it.each([768, 820])("is one centred, capped column on a %i wide tablet in portrait", (width) => {
    const layout = balancedLayoutOf(width, 24);
    expect(layout.kind).toBe("tablet-portrait");
    expect(layout.secondary).toBeNull();
    expect(layout.primary.width).toBe(680);
    expect(layout.primary.x * 2 + layout.primary.width).toBe(width);
  });

  it.each([1024, 1180, 1440, 1920])("is two columns that fit inside a %i wide screen", (width) => {
    const layout = balancedLayoutOf(width, 24);
    expect(layout.kind).toBe("wide");
    const second = layout.secondary!;
    expect(second).not.toBeNull();
    expect(layout.primary.x).toBeGreaterThanOrEqual(24);
    expect(layout.primary.x + layout.primary.width).toBeLessThan(second.x);
    expect(second.x + second.width).toBeLessThanOrEqual(width - 24);
  });

  it("keeps body text legible at every size", () => {
    for (const width of [375, 412, 820, 1180, 1920]) {
      expect(balancedLayoutOf(width, 16).textSize).toBeGreaterThanOrEqual(13);
    }
  });
});
