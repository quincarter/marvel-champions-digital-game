/**
 * MojoMania's choices raised in play (Longshot, the recorded cards, the expert heal): each has a plain-words name
 * and one-sentence explanation on its choice sheet.
 */
import { describe, expect, test } from "vitest";
import { setupCallCopyFor } from "../campaign/story.js";
import { instructionHeaderName } from "./choice-source.js";

describe("the choices raised in play read as questions", () => {
  test("Longshot, the recorded cards and the expert heal each have a plain name and one-sentence explanation", () => {
    for (const id of [
      "mojo.s2.setup.longshot",
      "mojo.s3.setup.longshot",
      "mojo.s2.setup.recorded-card",
      "mojo.s3.setup.recorded-cards",
      "mojo.s2.setup.heal",
      "mojo.s3.setup.heal",
    ]) {
      const copy = setupCallCopyFor(id)!;
      expect(copy.name, id).toBeTruthy();
      expect(copy.explain.length, id).toBeGreaterThan(40);
      expect(copy.explain).not.toMatch(/Not printed/);
    }
    expect(
      instructionHeaderName({ kind: "campaign", instructionId: "mojo.s2.setup.longshot", text: "", citation: "" }),
    ).toBe("Longshot");
    expect(instructionHeaderName({ kind: "campaign", instructionId: "other.id", text: "", citation: "" })).toBe(
      "Campaign setup",
    );
  });
});
