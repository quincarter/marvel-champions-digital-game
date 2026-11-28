// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-seats-header.js";
import type { McSeatsHeader } from "../McSeatsHeader.js";
import type { SeatsEvent, SeatsHeaderModel } from "../../seats.types.js";

afterEach(() => document.body.replaceChildren());

const bar: SeatsHeaderModel = { backLabel: "Back", title: "Take your seats", step: "STEP 2 OF 4 · 1 SEAT FILLED" };

async function mount(model: SeatsHeaderModel): Promise<McSeatsHeader> {
  const element = document.createElement("mc-seats-header") as McSeatsHeader;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-seats-header", () => {
  it("shows the back word, the title and the step, and raises back from its stop", async () => {
    const element = await mount(bar);
    const root = element.shadowRoot!;
    expect(root.querySelector(".word")!.textContent).toBe("Back");
    expect(root.querySelector(".title")!.textContent!.trim()).toBe("Take your seats");
    expect(root.querySelector(".step")!.textContent).toBe("STEP 2 OF 4 · 1 SEAT FILLED");
    const seen: SeatsEvent[] = [];
    element.addEventListener("mc-seats", (event) => seen.push((event as CustomEvent<SeatsEvent>).detail));
    root.querySelector<HTMLElement>('[data-stop="back"]')!.click();
    expect(seen).toEqual([{ type: "action", action: "back" }]);
  });

  it("draws the back glyph only while the scene gives one", async () => {
    const element = await mount(bar);
    expect(element.shadowRoot!.querySelector("mc-glyph")).toBeNull();
    element.model = { ...bar, backGlyph: { specs: [], height: 20, ground: "ink", openness: 1 } };
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector("mc-glyph")).not.toBeNull();
  });

  it("carries the title's drop and its limit as custom properties", async () => {
    const element = await mount({ ...bar, titleDrop: 12, titleMaxRight: 200 });
    const title = element.shadowRoot!.querySelector<HTMLElement>(".title")!;
    expect(title.style.getPropertyValue("--drop")).toBe("12px");
    expect(title.style.getPropertyValue("--max-right")).toBe("200px");
  });
});
