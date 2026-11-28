// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../../mc-stats-credited/mc-stats-credited";
import "../../mc-stats-matchup-legend/mc-stats-matchup-legend";
import "../mc-stats-matchup-grid";
import type { StatsEventDetail } from "../../shared/stats-events.types";
import type { StatsGridModel } from "../mc-stats-matchup-grid.types";

afterEach(() => document.body.replaceChildren());

const axis = (name: string) => ({ name, picture: null, cardId: null });

/** Two villains by three heroes: Rhino beaten at Expert by Spider-Man, Klaw played and lost to by Spider-Man. */
const grid: StatsGridModel = {
  kind: "heat",
  rows: [axis("Rhino"), axis("Klaw")],
  columns: [axis("Spider-Man"), axis("Captain Marvel"), axis("Black Panther")],
  looks: ["expert", "unplayed", "unplayed", "played", "unplayed", "unplayed"],
  words: ["2", "", "", "1", "", ""],
  tiers: { expert: { color: "#6b3fa0", ink: "#ffffff" } },
  legend: [{ kind: "tier", label: "Expert", color: "#6b3fa0" }],
  readout: (row, column) => ({
    title: `${["Rhino", "Klaw"][row]} × ${["Spider-Man", "Captain Marvel", "Black Panther"][column]}`,
    detail: row === 0 && column === 0 ? "Expert: 2 wins" : "Not played yet",
  }),
};

async function make(cursor = { row: 0, column: 0 }) {
  const el = document.createElement("mc-stats-matchup-grid");
  el.grid = grid;
  el.cursor = cursor;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-stats-matchup-grid", () => {
  it("draws a header per name and a cell per pairing, the cursor's cell marked and its tier in words", async () => {
    const el = await make();
    const root = el.shadowRoot!;
    expect(root.querySelectorAll('mc-stats-matchup-head[axis="column"]')).toHaveLength(3);
    expect(root.querySelectorAll('mc-stats-matchup-head[axis="row"]')).toHaveLength(2);
    const cells = [...root.querySelectorAll<HTMLElement>(".cell")];
    expect(cells).toHaveLength(6);
    expect(cells.map((c) => c.dataset.look)).toEqual([
      "expert",
      "unplayed",
      "unplayed",
      "played",
      "unplayed",
      "unplayed",
    ]);
    expect(cells[0]!.hasAttribute("data-cursor")).toBe(true);
    expect(cells[0]!.textContent!.trim()).toBe("2");
    expect(root.querySelector(".title")!.textContent).toBe("Rhino × Spider-Man");
    expect(root.querySelector(".detail")!.textContent).toBe("Expert: 2 wins");
  });

  it("moves the cursor a cell at a time, says so, and refuses at the edge so the arrow leaves the grid", async () => {
    const el = await make();
    const seen: StatsEventDetail[] = [];
    el.addEventListener("mc-player-stats", (e) => seen.push(e.detail));
    expect(el.step("up")).toBe(false);
    expect(el.step("left")).toBe(false);
    expect(el.step("right")).toBe(true);
    expect(el.step("down")).toBe(true);
    expect(el.cursor).toEqual({ row: 1, column: 1 });
    expect(el.step("down")).toBe(false);
    expect(seen.filter((d) => d.type === "grid-cursor")).toEqual([
      { type: "grid-cursor", row: 0, column: 1 },
      { type: "grid-cursor", row: 1, column: 1 },
    ]);
  });

  it("jumps to the first and last row, and reads the pairing under the cursor", async () => {
    const el = await make({ row: 0, column: 2 });
    el.edge("end");
    expect(el.cursor).toEqual({ row: 1, column: 2 });
    expect(el.readout).toEqual({ title: "Klaw × Black Panther", detail: "Not played yet" });
    el.edge("home");
    expect(el.cursor.row).toBe(0);
  });

  it("draws the key under the readout", async () => {
    const el = await make();
    expect(el.shadowRoot!.querySelector("mc-stats-matchup-legend")!.entries).toHaveLength(1);
  });

  it("draws nothing without a grid", async () => {
    const el = document.createElement("mc-stats-matchup-grid");
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.children.length).toBe(0);
  });
});
