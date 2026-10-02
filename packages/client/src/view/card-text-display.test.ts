import { describe, expect, test } from "vitest";
import { cardTextDisplay } from "./card-text-display.js";

describe("cardTextDisplay", () => {
  test("icons and traits read as words", () => {
    expect(cardTextDisplay("[star] Forced Response: equal to the number of boost icons ([boost]) discarded.")).toBe(
      "★ Forced Response: equal to the number of boost icons (boost icon) discarded.",
    );
    expect(cardTextDisplay("an (Alter_Ego) hero")).toBe("an (Alter Ego) hero");
    expect(cardTextDisplay("Place 2[per_hero] threat.")).toBe("Place 2 per hero threat.");
    expect(cardTextDisplay("[unknown] stays")).toBe("[unknown] stays");
  });
});
