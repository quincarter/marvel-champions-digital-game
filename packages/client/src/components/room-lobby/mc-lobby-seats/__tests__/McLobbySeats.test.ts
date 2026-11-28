// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-lobby-seats.js";
import type { McLobbySeats } from "../McLobbySeats.js";
import type { LobbyButtonModel, LobbyEvent, LobbySeatsModel } from "../../room-lobby.types.js";

afterEach(() => document.body.replaceChildren());

const button = (stop: string, label: string, command: LobbyEvent, enabled = true): LobbyButtonModel => ({
  stop,
  label,
  kind: "secondary",
  command,
  enabled,
});

const MODEL: LobbySeatsModel = {
  kind: "seats",
  title: "Seats",
  host: true,
  hint: "Players claim a seat, you approve",
  setup: button("setup", "Set up the table", { type: "setup" }),
  seatCount: {
    label: "Seats: 2",
    less: button("seats:less", "−", { type: "seat-count", to: 1 }),
    more: button("seats:more", "+", { type: "seat-count", to: 3 }),
    hint: "One to four seats",
  },
  plan: {
    heading: "The table",
    facts: "Standard difficulty",
    items: [{ key: "villain", name: "VILLAIN · Rhino", picture: { src: "/r.png" }, cardId: "01094" }],
    noSets: "No modular set",
  },
  note: "The build differs",
  result: {
    headline: "Did not start",
    lines: ["Seat 1: no deck"],
    dismiss: button("start-result-dismiss", "Dismiss", { type: "dismiss-result" }),
  },
  noSeats: "No seats",
  rows: [
    {
      id: "s1",
      mine: false,
      tag: "SEAT 1",
      deck: null,
      noDeck: "No deck yet",
      holder: { text: "Open", held: false, connected: false },
      requestedByMe: null,
      mismatch: null,
      action: button("seat:s1", "Ask", { type: "seat", seat: "s1", action: "ask" }),
      play: null,
      give: null,
      problem: null,
      missingMods: [],
      deckButton: null,
      requests: [],
    },
  ],
  people: { heading: "People", rows: [], compact: false },
};

async function mount(model: LobbySeatsModel | null): Promise<McLobbySeats> {
  const element = document.createElement("mc-lobby-seats") as McLobbySeats;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

/** Waits for the children's renders, then returns the inner element's `mc-button` of the lobby button with `stop`. */
async function innerButton(element: McLobbySeats, stop: string): Promise<HTMLElement> {
  const settle = async (root: ParentNode): Promise<void> => {
    for (const child of root.querySelectorAll("*")) {
      const update = (child as { updateComplete?: Promise<unknown> }).updateComplete;
      if (update) await update;
      if (child.shadowRoot) await settle(child.shadowRoot);
    }
  };
  await settle(element.shadowRoot!);
  const find = (root: ParentNode): HTMLElement | null => {
    const hit = root.querySelector<HTMLElement>(`[data-stop="${stop}"]`);
    if (hit) return hit;
    for (const child of root.querySelectorAll("*")) {
      const inner = child.shadowRoot ? find(child.shadowRoot) : null;
      if (inner) return inner;
    }
    return null;
  };
  const found = find(element.shadowRoot!);
  if (!found) throw new Error(`no stop ${stop}`);
  return found;
}

describe("mc-lobby-seats", () => {
  it("draws nothing without a model", async () => {
    const element = await mount(null);
    expect(element.shadowRoot!.querySelector(".panel")).toBeNull();
    expect(element.scroller).toBeNull();
  });

  it("composes the host's panel in order and exposes the list:seats scroller", async () => {
    const element = await mount(MODEL);
    const list = element.scroller!;
    expect(list.dataset.key).toBe("list:seats");
    expect(element.shadowRoot!.querySelector(".title")?.textContent).toBe("Seats");
    const order = [...list.children].map((c) => c.localName + (c.className ? `.${c.className}` : ""));
    expect(order).toEqual([
      "p.hint",
      "mc-lobby-button",
      "mc-lobby-seat-count",
      "mc-lobby-plan",
      "p.note",
      "mc-lobby-result",
      "mc-lobby-seat-row",
      "mc-lobby-people",
    ]);
  });

  it("leaves the host's controls and the title out for a guest on a tabbed layout, and says noSeats with no rows", async () => {
    const element = await mount({
      ...MODEL,
      title: null,
      host: false,
      setup: null,
      seatCount: null,
      hint: null,
      plan: null,
      result: null,
      rows: [],
    });
    const root = element.shadowRoot!;
    expect(root.querySelector(".title")).toBeNull();
    expect(root.querySelector(".hint")).toBeNull();
    expect(root.querySelector("mc-lobby-seat-count")).toBeNull();
    expect(root.querySelector(".none")?.textContent).toBe("No seats");
    expect(root.querySelector(".note")?.textContent).toBe("The build differs");
  });

  it("turns each button's press into one mc-room-lobby event and keeps mc-pressed to itself", async () => {
    const element = await mount(MODEL);
    const seen: LobbyEvent[] = [];
    const pressed: unknown[] = [];
    element.addEventListener("mc-room-lobby", (event) => seen.push(event.detail));
    document.body.addEventListener("mc-pressed", (event) => pressed.push(event));
    for (const stop of ["setup", "seats:more", "start-result-dismiss", "seat:s1"]) {
      (await innerButton(element, stop)).click();
    }
    expect(seen).toEqual([
      { type: "setup" },
      { type: "seat-count", to: 3 },
      { type: "dismiss-result" },
      { type: "seat", seat: "s1", action: "ask" },
    ]);
    expect(pressed).toEqual([]);
  });
});
