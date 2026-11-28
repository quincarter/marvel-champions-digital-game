// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-lobby-epic.js";
import type { McLobbyEpic } from "../McLobbyEpic.js";
import type { LobbyButtonModel, LobbyEpicModel, LobbyEvent } from "../../room-lobby.types.js";

afterEach(() => document.body.replaceChildren());

const button = (key: string, label = key): LobbyButtonModel => ({
  stop: key,
  label,
  kind: "secondary",
  command: { type: "epic", key },
});

const EPIC: LobbyEpicModel = {
  kind: "epic",
  title: "Tables",
  hint: "You organize the tables.",
  organizer: {
    tables: [button("epic:fewer", "Fewer tables"), button("epic:more", "More tables")],
    limit: button("epic:limit", "Time limit: none"),
    note: "Ends the game when time is up.",
  },
  limitLine: null,
  tables: [
    {
      id: "t1",
      mine: true,
      name: "Table 1",
      facts: "Pod: A · Standard · Waiting",
      hostLine: "Host: you",
      controls: [],
      seats: [],
    },
    {
      id: "t2",
      mine: false,
      name: "Table 2",
      facts: "Pod: B · Expert · Waiting",
      hostLine: "No host",
      controls: [],
      seats: [],
    },
  ],
  people: {
    heading: "People",
    compact: true,
    rows: [
      { id: "p1", name: "Ana (you)", role: "HOST", device: null, platform: null, more: null, line: "Ana (you) · Host" },
      { id: "p2", name: "Bo", role: "PLAYER", device: null, platform: null, more: null, line: "Bo · Player · Seat 1" },
    ],
  },
};

async function mount(model: LobbyEpicModel): Promise<McLobbyEpic> {
  const element = document.createElement("mc-lobby-epic") as McLobbyEpic;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-lobby-epic", () => {
  it("exposes one list:seats scroller holding everything", async () => {
    const element = await mount(EPIC);
    const scroller = element.scroller!;
    expect(scroller.dataset.key).toBe("list:seats");
    expect(scroller.querySelector(".hint")!.textContent).toBe("You organize the tables.");
    expect(scroller.querySelectorAll("mc-lobby-epic-table")).toHaveLength(2);
  });

  it("draws the organizer's rows and note, and no limit line", async () => {
    const element = await mount(EPIC);
    const root = element.shadowRoot!;
    expect(root.querySelectorAll(".organizer mc-lobby-button-row")).toHaveLength(2);
    expect(root.querySelector(".note")!.textContent).toBe("Ends the game when time is up.");
    expect(root.querySelector(".limit")).toBeNull();
  });

  it("gives everyone else the limit as a line", async () => {
    const element = await mount({ ...EPIC, organizer: null, limitLine: "Time limit: 90 minutes" });
    const root = element.shadowRoot!;
    expect(root.querySelector(".organizer")).toBeNull();
    expect(root.querySelector(".limit")!.textContent).toBe("Time limit: 90 minutes");
  });

  it("lists the people one line each under the heading", async () => {
    const element = await mount(EPIC);
    const root = element.shadowRoot!;
    expect(root.querySelector("mc-section-heading")!.getAttribute("label")).toBe("People");
    expect([...root.querySelectorAll(".person")].map((p) => p.textContent)).toEqual([
      "Ana (you) · Host",
      "Bo · Player · Seat 1",
    ]);
  });

  it("raises the organizer's command as one mc-room-lobby event", async () => {
    const element = await mount(EPIC);
    const seen: LobbyEvent[] = [];
    element.addEventListener("mc-room-lobby", (event) => seen.push((event as CustomEvent<LobbyEvent>).detail));
    const row = element.shadowRoot!.querySelector(".organizer mc-lobby-button-row")!;
    const inner = row
      .shadowRoot!.querySelectorAll("mc-lobby-button")[1]!
      .shadowRoot!.querySelector<HTMLElement>("mc-button")!;
    inner.click();
    expect(seen).toEqual([{ type: "epic", key: "epic:more" }]);
  });
});
