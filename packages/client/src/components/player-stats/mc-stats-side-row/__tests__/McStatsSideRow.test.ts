// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-stats-side-row";
import type { PressDetail } from "@mc/ui";

afterEach(() => document.body.replaceChildren());

async function make(selected: boolean) {
  const el = document.createElement("mc-stats-side-row");
  el.model = { row: 4, name: "Klaw", score: "9/63", selected };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-stats-side-row", () => {
  it("is a focus stop for its row, with the name and score in words", async () => {
    const el = await make(true);
    expect(el.getAttribute("data-stop")).toBe("side:4");
    expect(el.shadowRoot!.querySelector(".name")!.textContent).toBe("Klaw");
    expect(el.shadowRoot!.querySelector(".score")!.textContent).toBe("9/63");
    expect(el.hasAttribute("selected")).toBe(true);
    expect(el.getAttribute("aria-pressed")).toBe("true");
  });

  it("shows that villain on a tap", async () => {
    const el = await make(false);
    const seen: PressDetail[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push(e.detail));
    el.press();
    expect(seen).toEqual([{ action: { type: "focus-row", row: 4 }, hold: false }]);
  });
});
