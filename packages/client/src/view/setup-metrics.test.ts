import { describe, expect, test } from "vitest";
import { setupColumnWidth, setupMetrics } from "./setup-metrics.js";

describe("setupMetrics", () => {
  test("a phone-sized viewport reports the phone form factor", () => {
    expect(setupMetrics(390, 844).phone).toBe(true);
  });

  test("a short viewport (800x600) is flagged short", () => {
    expect(setupMetrics(800, 600).short).toBe(true);
  });

  test("a tall desktop viewport is neither phone nor short", () => {
    const m = setupMetrics(1280, 1000);
    expect(m.phone).toBe(false);
    expect(m.short).toBe(false);
  });
});

describe("setupColumnWidth", () => {
  test("never exceeds 640, and always leaves the padding on both sides", () => {
    expect(setupColumnWidth(1920, 1080)).toBeLessThanOrEqual(640);
    expect(setupColumnWidth(300, 700)).toBeLessThan(300);
  });
});
