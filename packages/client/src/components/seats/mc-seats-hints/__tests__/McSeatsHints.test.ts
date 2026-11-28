// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-seats-hints.js";
import type { McSeatsHints } from "../McSeatsHints.js";
import type { SeatsHintsModel } from "../../seats.types.js";

afterEach(() => document.body.replaceChildren());

const glyph = { specs: [], height: 16, ground: "paper" as const, openness: 1 };

async function mount(model: SeatsHintsModel): Promise<McSeatsHints> {
  const element = document.createElement("mc-seats-hints") as McSeatsHints;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-seats-hints", () => {
  it("says the heading, and only the hints that have a glyph", async () => {
    const element = await mount({
      heading: "Heroes — seat 1 of 4",
      hints: [
        { word: "Seat", glyph },
        { word: "Clear seat", glyph: null },
        { word: "Filters", glyph: { ...glyph, openness: 0 } },
        { word: "Inspect", glyph },
      ],
    });
    const root = element.shadowRoot!;
    expect(root.querySelector(".heading")!.textContent).toBe("Heroes — seat 1 of 4");
    expect([...root.querySelectorAll(".word")].map((word) => word.textContent)).toEqual(["Seat", "Inspect"]);
    expect(root.querySelectorAll("mc-glyph")).toHaveLength(2);
    expect(root.querySelectorAll("[data-stop]")).toHaveLength(0);
  });

  it("draws only the heading with a mouse or touch (no glyphs)", async () => {
    const element = await mount({ heading: "Heroes — seat 2 of 4", hints: [{ word: "Seat", glyph: null }] });
    expect(element.shadowRoot!.querySelector(".hint")).toBeNull();
  });
});
