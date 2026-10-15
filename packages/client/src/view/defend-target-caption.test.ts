import { describe, expect, test } from "vitest";
import { targetCaptionOf } from "./defend-choice.js";

describe("targetCaptionOf", () => {
  test("the viewer's own character reads 'Attacking you' with the short hero name", () => {
    expect(targetCaptionOf("You", "Spider-Man")).toBe("Attacking you — Spider-Man");
  });

  test("another seat whose name is its character's is said once", () => {
    expect(targetCaptionOf("Spider-Man", "Spider-Man")).toBe("Attacking Spider-Man");
  });

  test("a seat in its other form names both", () => {
    expect(targetCaptionOf("Spider-Man", "Peter Parker")).toBe("Attacking Spider-Man — Peter Parker");
  });
});
