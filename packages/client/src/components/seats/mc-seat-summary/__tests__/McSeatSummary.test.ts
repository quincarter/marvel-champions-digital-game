// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-seat-summary.js";
import type { McSeatSummary } from "../McSeatSummary.js";
import type { SeatSummaryModel, SeatsEvent } from "../../seats.types.js";

afterEach(() => document.body.replaceChildren());

const summary = (over: Partial<SeatSummaryModel> = {}): SeatSummaryModel => ({
  hint: null,
  lines: [
    { text: "Justice · 10 HP · hand 5", strong: true },
    { text: "THW 1 · ATK 2 · DEF 3", strong: true },
    { text: "Obligation: Hard Day", strong: false },
  ],
  clearLabel: "Clear seat",
  clearBlocked: null,
  ...over,
});

async function mount(model: SeatSummaryModel): Promise<McSeatSummary> {
  const element = document.createElement("mc-seat-summary") as McSeatSummary;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

const stops = (element: McSeatSummary): string[] =>
  [...element.shadowRoot!.querySelectorAll<HTMLElement>("[data-stop]")].map((part) => part.dataset.stop!);

describe("mc-seat-summary", () => {
  it("lists the lines, fading the soft ones, beside a Clear seat stop", async () => {
    const element = await mount(summary());
    const lines = [...element.shadowRoot!.querySelectorAll("li")];
    expect(lines.map((line) => line.textContent)).toEqual([
      "Justice · 10 HP · hand 5",
      "THW 1 · ATK 2 · DEF 3",
      "Obligation: Hard Day",
    ]);
    expect(lines.map((line) => line.className)).toEqual(["strong", "strong", "soft"]);
    expect(stops(element)).toEqual(["clear-seat"]);
  });

  it("says the hint of an empty seat and has no Clear", async () => {
    const element = await mount(summary({ hint: "Tap a hero below for seat 2.", lines: [] }));
    expect(element.shadowRoot!.querySelector(".hint")!.textContent).toBe("Tap a hero below for seat 2.");
    expect(stops(element)).toEqual([]);
  });

  it("raises clear-seat, and still raises it while the last hero stays (the scene says why)", async () => {
    const element = await mount(summary({ clearBlocked: "A game needs one hero" }));
    const clear = element.shadowRoot!.querySelector<HTMLElement>('[data-stop="clear-seat"]')!;
    expect(clear.getAttribute("aria-disabled")).toBe("true");
    expect(clear.getAttribute("title")).toBe("A game needs one hero");
    const seen: SeatsEvent[] = [];
    element.addEventListener("mc-seats", (event) => seen.push((event as CustomEvent<SeatsEvent>).detail));
    clear.click();
    expect(seen).toEqual([{ type: "clear-seat" }]);
  });

  it("is a disclosure with a toggle: shut shows only the toggle, open shows the block under it", async () => {
    const shut = await mount(summary({ toggle: { label: "Seat 1 · Justice · 10 HP ▸", open: false } }));
    expect(shut.shadowRoot!.querySelector(".toggle")!.textContent!.trim()).toBe("Seat 1 · Justice · 10 HP ▸");
    expect(shut.shadowRoot!.querySelector(".block")).toBeNull();
    expect(stops(shut)).toEqual(["seat-details-toggle"]);
    const seen: SeatsEvent[] = [];
    shut.addEventListener("mc-seats", (event) => seen.push((event as CustomEvent<SeatsEvent>).detail));
    shut.shadowRoot!.querySelector<HTMLElement>('[data-stop="seat-details-toggle"]')!.click();
    expect(seen).toEqual([{ type: "toggle", what: "details" }]);
    document.body.replaceChildren();
    const open = await mount(summary({ toggle: { label: "Seat 1 · Justice · 10 HP ▾", open: true } }));
    expect(stops(open)).toEqual(["seat-details-toggle", "clear-seat"]);
  });
});
