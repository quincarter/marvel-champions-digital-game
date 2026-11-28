// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-setup-seating";
import type { SetupEventDetail } from "../../shared/setup-events.types";
import type { SeatCell, SeatingInput } from "../mc-setup-seating.types";

vi.mock("../../../../session.js", () => ({
  appSession: () => ({ settings: { reducedMotion: true, firstPlayerTokenMotion: "toss" } }),
}));

afterEach(() => document.body.replaceChildren());

/** Presses a control a query found by its attribute (typed as a plain `Element`). */
const press = (el: Element | null | undefined): void => (el as unknown as { press(): void }).press();

const seat = (index: number, selected: boolean): SeatCell => ({
  index,
  name: `Hero ${index}`,
  meta: selected ? "First player" : `Seat ${index + 1}`,
  chipLabel: index === 0 ? "YOU" : `S${index + 1}`,
  selected,
  identityCardId: undefined,
});

const input = (first: number, over: Partial<SeatingInput> = {}): SeatingInput => ({
  seats: [seat(0, first === 0), seat(1, first === 1), seat(2, first === 2)],
  room: false,
  pictures: new Map(),
  ...over,
});

async function make(i: SeatingInput, mode: "wide" | "phone" = "wide") {
  const el = document.createElement("mc-setup-seating");
  el.input = i;
  el.mode = mode;
  document.body.append(el);
  await el.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  const seen: SetupEventDetail[] = [];
  el.addEventListener("mc-setup", (e) => seen.push(e.detail));
  return { el, seen };
}

const seatsOf = (el: HTMLElement) => [...el.shadowRoot!.querySelectorAll("mc-setup-seat")];

describe("mc-setup-seating", () => {
  it("draws a seat per hero as a first player stop, and a Random control on the header line when wide", async () => {
    const { el, seen } = await make(input(0));
    expect(seatsOf(el).map((s) => s.getAttribute("data-stop"))).toEqual([
      "first-player:0",
      "first-player:1",
      "first-player:2",
    ]);
    seatsOf(el)[2]!.press();
    const random = el.shadowRoot!.querySelector("mc-section-heading mc-chip")!;
    expect(random.getAttribute("data-stop")).toBe("first-player:random");
    press(random);
    expect(seen).toEqual([{ type: "seat-pick", index: 2 }, { type: "seat-roll" }]);
  });

  it("puts the Random control in the row as the last cell on a phone, and the heading says First player", async () => {
    const { el } = await make(input(0), "phone");
    expect(el.shadowRoot!.querySelector("mc-section-heading mc-chip")).toBeNull();
    expect(el.shadowRoot!.querySelector(".seats > mc-chip")!.getAttribute("data-stop")).toBe("first-player:random");
    expect(el.shadowRoot!.querySelector("mc-section-heading")!.getAttribute("label")).toBe("First player");
  });

  it("keeps one token in the first player's seat, and moves that same token when the first player changes", async () => {
    const { el } = await make(input(0));
    const token = seatsOf(el)[0]!.querySelector("mc-first-player-token")!;
    expect(token.slot).toBe("token");
    expect(el.probe()!.index).toBe(0);
    el.input = input(2);
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(seatsOf(el)[0]!.querySelector("mc-first-player-token")).toBeNull();
    expect(seatsOf(el)[2]!.querySelector("mc-first-player-token")).toBe(token);
    expect(el.probe()!.index).toBe(2);
  });

  it("shows only a note, and no token, in a room", async () => {
    const { el } = await make(input(0, { room: true }));
    expect(seatsOf(el).length).toBe(0);
    expect(el.shadowRoot!.querySelector(".note")).not.toBeNull();
    expect(el.probe()).toBeNull();
  });
});
