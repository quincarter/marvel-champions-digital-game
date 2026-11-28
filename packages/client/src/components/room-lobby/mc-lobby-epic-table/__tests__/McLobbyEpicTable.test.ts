// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-lobby-epic-table.js";
import type { McLobbyEpicTable } from "../McLobbyEpicTable.js";
import type { LobbyButtonModel, LobbyEpicTableModel, LobbyEvent, LobbySeatRowModel } from "../../room-lobby.types.js";

afterEach(() => document.body.replaceChildren());

const button = (key: string, label = key): LobbyButtonModel => ({
  stop: key,
  label,
  kind: "secondary",
  command: { type: "epic", key },
});

const seat = (id: string): LobbySeatRowModel => ({
  id,
  mine: false,
  tag: `SEAT ${id}`,
  deck: null,
  noDeck: "No deck yet",
  holder: { text: "Open", held: false, connected: false },
  requestedByMe: null,
  mismatch: null,
  action: null,
  play: null,
  give: null,
  problem: null,
  missingMods: [],
  deckButton: null,
  requests: [],
});

const TABLE: LobbyEpicTableModel = {
  id: "t1",
  mine: false,
  name: "Table 1",
  facts: "Pod: Bomb Scare · Standard · Waiting",
  hostLine: "Host: Ana",
  controls: [[button("rename:t1", "Rename"), button("pod:t1", "Next pod")], [button("drop:t1", "Drop")]],
  seats: [seat("s1"), seat("s2")],
};

async function mount(model: LobbyEpicTableModel): Promise<McLobbyEpicTable> {
  const element = document.createElement("mc-lobby-epic-table") as McLobbyEpicTable;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-lobby-epic-table", () => {
  it("shows the name, facts and host line from the model", async () => {
    const element = await mount(TABLE);
    const root = element.shadowRoot!;
    expect(root.querySelector(".name")!.textContent).toBe("Table 1");
    expect(root.querySelector(".facts")!.textContent).toBe("Pod: Bomb Scare · Standard · Waiting");
    expect(root.querySelector(".host")!.textContent).toBe("Host: Ana");
  });

  it("draws a control row per row and a seat row per seat", async () => {
    const element = await mount(TABLE);
    const root = element.shadowRoot!;
    expect(root.querySelectorAll("mc-lobby-button-row")).toHaveLength(2);
    const seats = [...root.querySelectorAll("mc-lobby-seat-row")] as unknown as { model: LobbySeatRowModel }[];
    expect(seats.map((s) => s.model.id)).toEqual(["s1", "s2"]);
  });

  it("marks your own table, and leaves the controls out when there are none", async () => {
    const element = await mount({ ...TABLE, mine: true, controls: [] });
    expect(element.hasAttribute("mine")).toBe(true);
    expect(element.shadowRoot!.querySelector(".controls")).toBeNull();
  });

  it("turns a control press into one mc-room-lobby epic event", async () => {
    const element = await mount(TABLE);
    const seen: LobbyEvent[] = [];
    element.addEventListener("mc-room-lobby", (event) => seen.push((event as CustomEvent<LobbyEvent>).detail));
    let leaked = 0;
    document.body.addEventListener("mc-pressed", () => leaked++);
    const row = element.shadowRoot!.querySelectorAll("mc-lobby-button-row")[1]!;
    const inner = row
      .shadowRoot!.querySelector("mc-lobby-button")!
      .shadowRoot!.querySelector<HTMLElement>("mc-button")!;
    inner.click();
    expect(seen).toEqual([{ type: "epic", key: "drop:t1" }]);
    expect(leaked).toBe(0);
  });
});
