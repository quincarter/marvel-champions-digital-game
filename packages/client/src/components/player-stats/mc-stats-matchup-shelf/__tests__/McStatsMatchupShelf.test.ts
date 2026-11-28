// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../../mc-stats-credited/mc-stats-credited";
import "../mc-stats-matchup-shelf";
import type { PressDetail } from "@mc/ui";
import type { StatsShelfModel } from "../mc-stats-matchup-shelf.types";

afterEach(() => document.body.replaceChildren());

const shelf: StatsShelfModel = {
  row: 1,
  name: "Klaw",
  summary: "9 of 63 beaten · 3 tried",
  short: "9 · 3 tried",
  bar: [{ count: 9, color: "#6b3fa0" }],
  total: 63,
  pips: [
    { kind: "tier", color: "#6b3fa0" },
    { kind: "played", color: "" },
    { kind: "unplayed", color: "" },
  ],
  best: "Expert",
  bestColor: "#6b3fa0",
  bestInk: "#ffffff",
  picture: { src: "/k.png" },
  cardId: "01095",
};

async function make(model: StatsShelfModel | null) {
  const el = document.createElement("mc-stats-matchup-shelf");
  el.shelf = model;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-stats-matchup-shelf", () => {
  it("is a focus stop for its row and says its villain, record, pips and best tier", async () => {
    const el = await make(shelf);
    const root = el.shadowRoot!;
    expect(el.getAttribute("data-stop")).toBe("row:shelf:1");
    expect(root.querySelector("mc-stats-credited")!.getAttribute("label")).toBe("KLAW");
    expect(root.querySelector(".long")!.textContent).toBe("9 of 63 beaten · 3 tried");
    expect(root.querySelectorAll(".pip")).toHaveLength(3);
    expect(root.querySelector(".badge")!.textContent!.trim()).toBe("Expert");
    expect(root.querySelector(".thumb")!.getAttribute("data-card-id")).toBe("01095");
  });

  it("opens the Focus view on a tap, and has no badge before anything is beaten", async () => {
    const el = await make({ ...shelf, best: "" });
    const seen: PressDetail[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push(e.detail));
    el.press();
    expect(seen).toEqual([{ action: { type: "open-focus", row: 1 }, hold: false }]);
    expect(el.shadowRoot!.querySelector(".badge")).toBeNull();
  });
});
