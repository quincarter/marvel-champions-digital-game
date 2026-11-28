// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-stats-chip-row";
import type { StatsEventDetail } from "../../shared/stats-events.types";
import type { StatsChipModel } from "../mc-stats-chip-row.types";

afterEach(() => document.body.replaceChildren());

const chips: StatsChipModel[] = [
  { key: "filter:hero", label: "All heroes", selected: false, action: { type: "filter", filter: "hero" } },
  { key: "grid:flip", label: "Flip axes", selected: true, action: { type: "grid-toggle", toggle: "flip" } },
];

async function row(list: StatsChipModel[], scroll = false) {
  const el = document.createElement("mc-stats-chip-row");
  el.chips = list;
  el.swipe = scroll;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-stats-chip-row", () => {
  it("draws a chip per entry as a focus stop under its key, the chosen one filled", async () => {
    const el = await row(chips);
    const drawn = [...el.shadowRoot!.querySelectorAll("mc-chip")];
    expect(drawn.map((c) => c.getAttribute("data-stop"))).toEqual(["filter:hero", "grid:flip"]);
    expect(drawn.map((c) => c.hasAttribute("selected"))).toEqual([false, true]);
    expect(drawn[0]!.getAttribute("label")).toBe("All heroes");
  });

  it("says what a press meant as one typed event", async () => {
    const el = await row(chips);
    const seen: StatsEventDetail[] = [];
    el.addEventListener("mc-player-stats", (e) => seen.push(e.detail));
    (el.shadowRoot!.querySelectorAll("mc-chip")[1] as HTMLElement & { press(): void }).press();
    expect(seen).toEqual([{ type: "grid-toggle", toggle: "flip" }]);
  });

  it("reflects the swiping row for the stylesheet", async () => {
    const el = await row(chips, true);
    expect(el.hasAttribute("swipe")).toBe(true);
  });
});
