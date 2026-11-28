// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-civil-review.js";
import type { McCivilReview } from "../McCivilReview.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McCivilReview> {
  const el = document.createElement("mc-civil-review");
  el.view = {
    preconstructedEnabled: true,
    difficultyChoices: [
      { id: "standard", name: "Standard", description: "d", action: "civil:difficulty:standard", selected: true },
    ],
    randomPins: [{ action: "civil:pin:side", label: "Keep side", on: false }],
    modeOptions: [{ id: "coop", label: "Co-op", note: "As written", selected: true, enabled: true }],
  } as never;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-civil-review", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    const stops = [...root.querySelectorAll("mc-press-card")].map((c) => c.getAttribute("data-stop"));
    expect(stops).toEqual(["civil:preconstructed", "civil:difficulty:standard", "civil:pin:side", "civil:mode:coop"]);
    expect(root.querySelector("mc-civil-summary")).toBeNull();
  });
});
