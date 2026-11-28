// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-past-game-summary.js";
import type { McPastGameSummary } from "../McPastGameSummary.js";
import type { PastGameSummaryModel } from "../mc-past-game-summary.types.js";

afterEach(() => document.body.replaceChildren());

const model: PastGameSummaryModel = {
  result: "WON",
  tone: "won",
  reason: "Villain defeated",
  title: "Rhino · Spider-Man",
  when: "3 rounds · 24 min",
  fates: "Stood: Spider-Man",
  campaign: null,
};

async function mount(m: PastGameSummaryModel | null, size?: "detail"): Promise<McPastGameSummary> {
  const el = document.createElement("mc-past-game-summary");
  el.model = m;
  if (size) el.size = size;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-past-game-summary", () => {
  it("says the result, why, what the game was, when and who fell or stood", async () => {
    const el = await mount(model);
    const root = el.shadowRoot!;
    expect(root.querySelector(".result")!.textContent).toBe("WON");
    expect(root.querySelector<HTMLElement>(".result")!.dataset.tone).toBe("won");
    expect(root.querySelector(".reason")!.textContent).toBe("Villain defeated");
    expect(root.querySelector(".title")!.textContent).toBe("Rhino · Spider-Man");
    expect(root.querySelector(".when")!.textContent).toBe("3 rounds · 24 min");
    expect(root.querySelector(".fates")!.textContent).toBe("Stood: Spider-Man");
    expect(root.querySelector(".campaign")).toBeNull();
  });

  it("leaves out the fates line when the reason says it, and adds the campaign in the details", async () => {
    const el = await mount({ ...model, fates: null, campaign: "Campaign: Red Skull" }, "detail");
    expect(el.shadowRoot!.querySelector(".fates")).toBeNull();
    expect(el.shadowRoot!.querySelector(".campaign")!.textContent).toBe("Campaign: Red Skull");
    expect(el.getAttribute("size")).toBe("detail");
  });

  it("draws nothing without a model", async () => {
    const el = await mount(null);
    expect(el.shadowRoot!.querySelector(".head")).toBeNull();
  });
});
