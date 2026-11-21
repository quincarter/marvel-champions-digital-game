import { describe, expect, test } from "vitest";
import { statWords } from "./stat-words.js";
import { panelHasBadges } from "./layout.js";

describe("statWords", () => {
  test("says HP first, then each stat, a dash kept", () => {
    expect(
      statWords({
        hp: { current: 12, max: 12 },
        stats: [
          { label: "REC", value: "4", bonus: 0 },
          { label: "ATK", value: "—", bonus: 0 },
          { label: "HP", value: "12", bonus: 0 },
        ],
      } as never),
    ).toBe("HP 12/12 · REC 4 · ATK —");
  });
  test("is empty with nothing to say", () => {
    expect(statWords({ hp: null, stats: [] })).toBe("");
  });
});

describe("panelHasBadges", () => {
  test("a one-line row has none; a card-sized panel does", () => {
    expect(panelHasBadges(40)).toBe(false);
    expect(panelHasBadges(128)).toBe(true);
  });
});
