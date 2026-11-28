// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-detail-insights.js";
import type { McDetailInsights } from "../McDetailInsights.js";

afterEach(() => document.body.replaceChildren());

async function mount(insights: McDetailInsights["insights"]): Promise<McDetailInsights> {
  const el = document.createElement("mc-detail-insights") as McDetailInsights;
  el.insights = insights;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-detail-insights", () => {
  it("lists each line with its tone, and marks a caution with a bang so colour is not the only clue", async () => {
    const el = await mount([
      { text: "Team-Up (seats 1 and 2): Spider-Man holds 2 copies.", tone: "meta" },
      { text: "Both seats play Spider-Man.", tone: "caution" },
    ]);
    const lines = [...el.shadowRoot!.querySelectorAll<HTMLElement>(".line")];
    expect(lines.map((line) => line.dataset.tone)).toEqual(["meta", "caution"]);
    expect(lines.map((line) => line.querySelector(".text")!.textContent)).toEqual([
      "Team-Up (seats 1 and 2): Spider-Man holds 2 copies.",
      "Both seats play Spider-Man.",
    ]);
    expect(lines[0]!.querySelector(".mark")).toBeNull();
    expect(lines[1]!.querySelector(".mark")!.textContent).toBe("!");
  });

  it("is a polite live region, and draws nothing with no lines", async () => {
    const el = await mount([]);
    expect(el.getAttribute("aria-live")).toBe("polite");
    expect(el.shadowRoot!.querySelector(".lines")).toBeNull();
    el.insights = [{ text: "Why: it counters Sandman.", tone: "meta" }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".line")).toHaveLength(1);
  });
});
