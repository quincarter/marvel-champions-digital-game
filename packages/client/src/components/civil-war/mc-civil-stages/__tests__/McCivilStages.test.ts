// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-civil-stages.js";
import type { McCivilStages } from "../McCivilStages.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McCivilStages> {
  const el = document.createElement("mc-civil-stages");
  el.rows = [
    {
      stageNumber: 1,
      label: "Stage 1",
      hidden: false,
      options: [
        {
          printedCardId: "p",
          name: "Public Outrage",
          targetThreat: "14",
          gist: "g",
          action: "civil:stage:1:p",
          selected: true,
          recommended: true,
          face: null,
        },
      ],
    },
    { stageNumber: 2, label: "Stage 2", hidden: true, options: [] },
  ] as never;
  el.summary = "Public Outrage.";
  el.pictures = { leader: () => ({ src: null }), face: () => ({ src: null }), back: { src: null } };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-civil-stages", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect(root.querySelector("mc-press-card")!.getAttribute("data-stop")).toBe("civil:stage:1:p");
    expect(root.querySelector(".threat")!.textContent).toContain("Recommended");
    expect(root.querySelector(".hidden .name")!.textContent).toBe("Stage 2: hidden");
    expect(root.querySelector(".summary")!.textContent).toBe("Public Outrage.");
  });
});
