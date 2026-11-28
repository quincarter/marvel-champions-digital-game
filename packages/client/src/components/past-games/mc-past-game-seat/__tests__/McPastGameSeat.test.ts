// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-past-game-seat.js";

afterEach(() => document.body.replaceChildren());

describe("mc-past-game-seat", () => {
  it("sets the heading and one line per fact", async () => {
    const el = document.createElement("mc-past-game-seat");
    el.model = { heading: "Spider-Man · Stood", lines: ["12 damage · 5 thwart", "Deck: Justice"] };
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".heading")!.textContent).toBe("Spider-Man · Stood");
    expect([...el.shadowRoot!.querySelectorAll(".line")].map((line) => line.textContent)).toEqual([
      "12 damage · 5 thwart",
      "Deck: Justice",
    ]);
  });

  it("draws nothing without a model", async () => {
    const el = document.createElement("mc-past-game-seat");
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".heading")).toBeNull();
  });
});
