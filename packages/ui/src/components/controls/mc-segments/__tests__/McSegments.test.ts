// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-segments";
import type { McSegmentOption } from "../mc-segments.types";

afterEach(() => document.body.replaceChildren());

const options: McSegmentOption[] = [
  { stop: "a", label: "Small", selected: false, action: "small" },
  { stop: "b", label: "Large", selected: true, action: "large" },
];

describe("mc-segments", () => {
  it("draws a cell per option, the chosen one marked, each a focus stop", async () => {
    const el = document.createElement("mc-segments");
    el.options = options;
    document.body.append(el);
    await el.updateComplete;
    const cells = [...el.shadowRoot!.querySelectorAll("mc-segment-cell")];
    expect(cells.map((c) => c.getAttribute("data-stop"))).toEqual(["a", "b"]);
    expect(cells.map((c) => c.hasAttribute("selected"))).toEqual([false, true]);
  });

  it("lets a cell's press bubble out with that cell's action", async () => {
    const el = document.createElement("mc-segments");
    el.options = options;
    document.body.append(el);
    await el.updateComplete;
    const seen: unknown[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push((e as CustomEvent).detail));
    el.shadowRoot!.querySelectorAll("mc-segment-cell")[0]!.click();
    expect(seen).toEqual([{ action: "small", hold: false }]);
  });

  it("is the bare strip without a heading, and a settings row with one", async () => {
    const el = document.createElement("mc-segments");
    el.options = options;
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".row")).toBeNull();
    expect(el.shadowRoot!.querySelector(".strip")).not.toBeNull();
    el.heading = "Card size";
    el.detail = "How big the cards are.";
    el.dimmed = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".heading")!.textContent).toBe("Card size");
    expect(el.shadowRoot!.querySelector(".detail")!.textContent).toBe("How big the cards are.");
    expect(el.shadowRoot!.querySelectorAll("mc-segment-cell").length).toBe(2);
    expect(el.hasAttribute("dimmed")).toBe(true);
  });
});
