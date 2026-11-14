import { describe, expect, it } from "vitest";
import { failedScreenText } from "./error-log.js";

describe("failedScreenText", () => {
  it("names the screen, the error and the way out", () => {
    const text = failedScreenText(["Setup"], "no playable starter deck x");
    expect(text).toContain("This screen (Setup) could not be drawn.");
    expect(text).toContain("Error: no playable starter deck x");
    expect(text).toMatch(/title/);
  });
});
