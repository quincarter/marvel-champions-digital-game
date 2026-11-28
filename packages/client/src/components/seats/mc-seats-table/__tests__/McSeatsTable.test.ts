// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-seats-table.js";
import type { McSeatsTable } from "../McSeatsTable.js";
import type { SeatModel, SeatPairModel, SeatsEvent } from "../../seats.types.js";

afterEach(() => document.body.replaceChildren());

const seat = (index: number, over: Partial<SeatModel> = {}): SeatModel => ({
  index,
  deckId: index === 0 ? "precon:core-spider-man-justice" : null,
  frame: index === 0 ? "activeFilled" : index === 1 ? "empty" : "locked",
  label: `SEAT ${index + 1}`,
  name: index === 0 ? "Spider-Man" : null,
  meta: index === 0 ? "Justice · 10 HP" : null,
  empty: index === 0 ? null : "Empty",
  picture: null,
  clearLabel: index === 0 ? "Clear seat" : null,
  ...over,
});

const seats = (): SeatModel[] => [0, 1, 2, 3].map((index) => seat(index));

async function mount(init: Partial<McSeatsTable>): Promise<McSeatsTable> {
  const table = document.createElement("mc-seats-table") as McSeatsTable;
  Object.assign(table, init);
  document.body.append(table);
  await table.updateComplete;
  return table;
}

describe("mc-seats-table", () => {
  it("draws a card per seat on a wide screen and a chip per seat when compact", async () => {
    const wide = await mount({ seats: seats() });
    expect(wide.shadowRoot!.querySelectorAll("mc-seat-card").length).toBe(4);
    expect(wide.shadowRoot!.querySelectorAll("mc-seat-chip").length).toBe(0);
    wide.compact = true;
    await wide.updateComplete;
    expect(wide.shadowRoot!.querySelectorAll("mc-seat-card").length).toBe(0);
    expect(wide.shadowRoot!.querySelectorAll("mc-seat-chip").length).toBe(4);
    expect(wide.hasAttribute("compact")).toBe(true);
  });

  it("gives each Team-Up pair its columns and its words, three rows at most", async () => {
    const pair = (a: number, b: number, label: string): SeatPairModel => ({ seats: [a, b], label, picture: null });
    const table = await mount({
      seats: seats(),
      pairs: [
        pair(1, 2, "Team-Up: A and B"),
        pair(2, 4, "Team-Up: B and D"),
        pair(1, 4, "Team-Up: A and D"),
        pair(3, 4, "x"),
      ],
    });
    const rows = [...table.shadowRoot!.querySelectorAll<HTMLElement>(".pair")];
    expect(rows.map((row) => [row.dataset.from, row.dataset.to, row.dataset.span])).toEqual([
      ["1", "2", "2"],
      ["2", "4", "3"],
      ["1", "4", "4"],
    ]);
    expect(rows[0]!.querySelector(".words")!.textContent).toBe("Team-Up: A and B");
  });

  it("orders a pair's seats low to high", async () => {
    const table = await mount({ seats: seats(), pairs: [{ seats: [3, 1], label: "x", picture: null }] });
    const row = table.shadowRoot!.querySelector<HTMLElement>(".pair")!;
    expect([row.dataset.from, row.dataset.to]).toEqual(["1", "3"]);
  });

  it("shows the summary strip only where there is one, and lets a seat's event through", async () => {
    const table = await mount({ seats: seats() });
    expect(table.shadowRoot!.querySelector("mc-seat-summary")).toBeNull();
    table.summary = { hint: "Tap a hero.", lines: [], clearLabel: "Clear seat", clearBlocked: null };
    await table.updateComplete;
    expect(table.shadowRoot!.querySelector("mc-seat-summary")).not.toBeNull();
    const seen: SeatsEvent[] = [];
    table.addEventListener("mc-seats", (event) => seen.push((event as CustomEvent<SeatsEvent>).detail));
    const card = table.shadowRoot!.querySelectorAll("mc-seat-card")[1]!;
    await (card as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    card.shadowRoot!.querySelector<HTMLElement>('[data-stop="seat:1"]')!.click();
    expect(seen).toEqual([{ type: "seat", index: 1 }]);
  });
});
