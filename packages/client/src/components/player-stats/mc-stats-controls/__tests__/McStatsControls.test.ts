// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-stats-controls";
import type { StatsEventDetail } from "../../shared/stats-events.types";
import type { StatsControlRow } from "../mc-stats-controls.types";

afterEach(() => document.body.replaceChildren());

const rows: StatsControlRow[] = [
  {
    kind: "chips",
    id: "filters",
    scroll: false,
    chips: [{ key: "filter:hero", label: "All heroes", selected: false, action: { type: "filter", filter: "hero" } }],
  },
  {
    kind: "stepper",
    id: "hero",
    label: "Spider-Man · 4 games",
    prevStop: "hero:previous",
    nextStop: "hero:next",
    nameStop: "hero:01001a",
    prevAction: { type: "hero-step", direction: -1 },
    nextAction: { type: "hero-step", direction: 1 },
    prevGlyph: undefined,
    nextGlyph: undefined,
    several: true,
  },
  { kind: "share", id: "share", input: { kind: "on", label: "Sharing on" } },
];

async function controls(list: readonly StatsControlRow[]) {
  const el = document.createElement("mc-stats-controls");
  el.rows = list;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-stats-controls", () => {
  it("stacks each row as its own element, in order", async () => {
    const el = await controls(rows);
    const kinds = [...el.shadowRoot!.children].map((c) => c.localName);
    expect(kinds).toEqual(["mc-stats-chip-row", "mc-stepper", "mc-stats-share"]);
  });

  it("hears the stepper's arrows as the screen's own event", async () => {
    const el = await controls(rows);
    const seen: StatsEventDetail[] = [];
    el.addEventListener("mc-player-stats", (e) => seen.push(e.detail));
    const stepper = el.shadowRoot!.querySelector("mc-stepper")!;
    await stepper.updateComplete;
    (stepper.shadowRoot!.querySelectorAll("mc-chip")[2] as HTMLElement & { press(): void }).press();
    expect(seen).toEqual([{ type: "hero-step", direction: 1 }]);
  });

  it("draws nothing for no rows", async () => {
    const el = await controls([]);
    expect(el.shadowRoot!.querySelectorAll("*").length).toBe(0);
  });
});
