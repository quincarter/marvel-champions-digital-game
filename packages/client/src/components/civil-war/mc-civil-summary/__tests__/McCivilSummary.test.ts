// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-civil-summary.js";
import type { McCivilSummary } from "../McCivilSummary.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McCivilSummary> {
  const el = document.createElement("mc-civil-summary");
  el.view = {
    summary: ["Iron Man", "Standard", "Four sets", "Fact"],
    expertNote: null,
    summaryArt: {
      leader: { scenarioId: "s", cardId: "c", name: "Iron Man" },
      stages: [
        { label: "1", name: "Outrage", face: null, hidden: false },
        { label: "2", name: "x", face: null, hidden: true },
      ],
      setsHidden: true,
      sets: [],
      setCount: 2,
    },
  } as never;
  el.pictures = { leader: () => ({ src: null }), face: () => ({ src: null }), back: { src: null } };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-civil-summary", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect(root.querySelector(".first")!.textContent).toBe("Iron Man");
    expect(root.querySelectorAll(".stages figure").length).toBe(2);
    expect(root.querySelector(".back")).not.toBeNull();
    expect(root.querySelectorAll(".sets mc-picture-tile").length).toBe(2);
  });
});
