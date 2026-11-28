// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-stats-row";
import type { PressDetail } from "@mc/ui";
import type { StatsRowModel } from "../mc-stats-row.types";

afterEach(() => document.body.replaceChildren());

const base: StatsRowModel = {
  id: "hero:01001a",
  label: "Spider-Man",
  value: "4–1",
  detail: "5 games",
  highlight: false,
  cardId: "01001a",
  picture: { src: "/a.png" },
  gameId: null,
  linkLabel: "View game ▸",
  losses: [],
  lossLegend: "",
};

async function row(over: Partial<StatsRowModel> = {}) {
  const el = document.createElement("mc-stats-row");
  el.stop = "row:hero:01001a";
  el.row = { ...base, ...over };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const heard = (el: HTMLElement): PressDetail[] => {
  const seen: PressDetail[] = [];
  el.addEventListener("mc-pressed", (e) => seen.push(e.detail));
  return seen;
};

describe("mc-stats-row", () => {
  it("says its label, figure and line, and leads with its card's picture", async () => {
    const el = await row();
    const root = el.shadowRoot!;
    expect(el.getAttribute("data-stop")).toBe("row:hero:01001a");
    expect(root.querySelector(".label")!.textContent).toBe("Spider-Man");
    expect(root.querySelector(".value")!.textContent).toBe("4–1");
    expect(root.querySelector(".detail")!.textContent).toBe("5 games");
    expect(root.querySelector(".thumb")!.getAttribute("data-card-id")).toBe("01001a");
  });

  it("opens its game on a tap and the route's Enter, when it names one", async () => {
    const el = await row({ gameId: "g1", cardId: null, picture: null });
    const seen = heard(el);
    el.press();
    el.click();
    expect(seen.map((d) => d.action)).toEqual([
      { type: "open-game", gameId: "g1" },
      { type: "open-game", gameId: "g1" },
    ]);
    expect(el.shadowRoot!.querySelector(".link")!.textContent).toBe("View game ▸");
  });

  it("does nothing on a tap of a card row with no game, but Enter and Inspect open the card", async () => {
    const el = await row();
    const seen = heard(el);
    el.press();
    expect(seen).toEqual([]);
    el.click();
    el.inspect();
    expect(seen.map((d) => [d.action, d.hold])).toEqual([
      [{ type: "card", cardId: "01001a" }, true],
      [{ type: "card", cardId: "01001a" }, true],
    ]);
  });

  it("draws the why-you-lose bar with its words, and a headline row filled", async () => {
    const el = await row({ highlight: true, losses: [{ count: 2, color: "red" }], lossLegend: "Scheme 2" });
    expect(el.hasAttribute("highlight")).toBe(true);
    expect(el.shadowRoot!.querySelector("mc-segment-bar")!.parts).toHaveLength(1);
    expect(el.shadowRoot!.querySelector(".legend")!.textContent).toBe("Scheme 2");
  });
});
