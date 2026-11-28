// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-stats-matchup-side";
import type { StatsEventDetail } from "../../shared/stats-events.types";

afterEach(() => document.body.replaceChildren());

async function side() {
  const el = document.createElement("mc-stats-matchup-side");
  el.rows = [
    { row: 0, name: "Rhino", score: "3/63", selected: false },
    { row: 1, name: "Klaw", score: "9/63", selected: true },
  ];
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-stats-matchup-side", () => {
  it("lists every villain as a focus stop, the shown one filled", async () => {
    const el = await side();
    const rows = [...el.shadowRoot!.querySelectorAll("mc-stats-side-row")];
    await Promise.all(rows.map((r) => r.updateComplete));
    expect(rows.map((r) => r.getAttribute("data-stop"))).toEqual(["side:0", "side:1"]);
    expect(rows.map((r) => r.hasAttribute("selected"))).toEqual([false, true]);
  });

  it("says a row chosen as one typed event", async () => {
    const el = await side();
    const seen: StatsEventDetail[] = [];
    el.addEventListener("mc-player-stats", (e) => seen.push(e.detail));
    const row = el.shadowRoot!.querySelectorAll("mc-stats-side-row")[0]!;
    await row.updateComplete;
    row.press();
    expect(seen).toEqual([{ type: "focus-row", row: 0 }]);
  });
});
