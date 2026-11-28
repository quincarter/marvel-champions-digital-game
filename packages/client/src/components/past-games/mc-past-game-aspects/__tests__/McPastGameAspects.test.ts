// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-past-game-aspects.js";
import type { McPastGameAspects } from "../McPastGameAspects.js";

afterEach(() => document.body.replaceChildren());

async function mount(badges: McPastGameAspects["badges"]): Promise<McPastGameAspects> {
  const el = document.createElement("mc-past-game-aspects");
  el.badges = badges;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-past-game-aspects", () => {
  it("draws one chip per badge in the aspect's own colours, with the name, the code and the letter", async () => {
    const el = await mount([
      { id: "justice", full: "JUSTICE", code: "JUS", letter: "J" },
      { id: "pool", full: "'POOL", code: "'PL", letter: "P" },
    ]);
    const chips = [...el.shadowRoot!.querySelectorAll<HTMLElement>(".chip")];
    expect(chips).toHaveLength(2);
    expect(chips[0]!.getAttribute("style")).toContain("var(--mc-fill-justice)");
    expect(chips[0]!.getAttribute("style")).toContain("var(--mc-text-on-justice)");
    expect(chips[0]!.querySelector(".full")!.textContent).toBe("JUSTICE");
    expect(chips[0]!.querySelector(".code")!.textContent).toBe("JUS");
    expect(chips[1]!.querySelector(".letter")!.textContent).toBe("P");
  });

  it("sizes the room a name needs by its length", async () => {
    const el = await mount([
      { id: "basic", full: "BASIC", code: "BAS", letter: "B" },
      { id: "justice", full: "JUSTICE", code: "JUS", letter: "J" },
      { id: "aggression", full: "AGGRESSION", code: "AGG", letter: "A" },
    ]);
    const fits = [...el.shadowRoot!.querySelectorAll<HTMLElement>(".word")].map((word) => word.dataset.fit);
    expect(fits).toEqual(["short", "mid", "long"]);
  });

  it("draws nothing without badges", async () => {
    const el = await mount([]);
    expect(el.shadowRoot!.querySelectorAll(".chip")).toHaveLength(0);
  });
});
