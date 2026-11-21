import { describe, expect, it } from "vitest";
import type { KeywordInstance } from "@mc/content";
import { keywordLabel, keywordNameOf } from "./keyword-label.js";

describe("keywordLabel", () => {
  it("prints a keyword with its value", () => {
    expect(keywordLabel({ name: "retaliate", value: 1 } as KeywordInstance)).toBe("retaliate 1");
    expect(keywordLabel({ name: "teamUp" } as unknown as KeywordInstance)).toBe("team Up");
  });

  // #943: a pack granted `gainsKeyword("guard", …)`, a bare string, and drawing the decision sheet threw on it.
  it("reads bad pack data without throwing", () => {
    expect(keywordLabel("guard" as unknown as KeywordInstance)).toBe("guard");
    expect(keywordLabel({} as KeywordInstance)).toBe("Keyword");
    expect(keywordLabel(undefined as unknown as KeywordInstance)).toBe("Keyword");
    expect(keywordNameOf("guard")).toBe("guard");
    expect(keywordNameOf({ name: 3 })).toBeNull();
    expect(keywordNameOf(null)).toBeNull();
  });
});
