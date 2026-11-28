// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-trophy-rank.js";
import type { McTrophyRank } from "../McTrophyRank.js";

afterEach(() => document.body.replaceChildren());

async function mount(model: McTrophyRank["model"]): Promise<McTrophyRank> {
  const el = document.createElement("mc-trophy-rank");
  el.model = model;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-trophy-rank", () => {
  it("says the rank in capitals, the way to the next one and the earned count, with a bar to the next rank", async () => {
    const el = await mount({
      rankLabel: "Rank 3 of 9",
      title: "Street-Level Hero",
      pointsLabel: "1,250 lifetime points",
      fraction: 0.6,
      nextLabel: "300 to Local Legend",
      earnedLabel: "12 of 140 achievements",
    });
    const root = el.shadowRoot!;
    expect(root.querySelector(".rank")!.textContent).toBe("RANK 3 OF 9");
    expect(root.querySelector(".points")!.textContent).toBe("1,250 LIFETIME POINTS");
    expect(root.querySelector(".title")!.textContent).toBe("STREET-LEVEL HERO");
    expect(root.querySelector(".next")!.textContent).toBe("300 to Local Legend");
    expect(root.querySelector(".earned")!.textContent).toBe("12 of 140 achievements");
    expect(root.querySelector<HTMLElement & { fraction: number }>("mc-progress-bar")!.fraction).toBe(0.6);
  });

  it("draws nothing without a header", async () => {
    const el = await mount(null);
    expect(el.shadowRoot!.querySelector(".top")).toBeNull();
  });
});
