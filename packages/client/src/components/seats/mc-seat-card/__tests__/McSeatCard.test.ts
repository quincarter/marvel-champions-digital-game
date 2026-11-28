// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-seat-card.js";
import type { McSeatCard } from "../McSeatCard.js";
import type { SeatModel, SeatsEvent } from "../../seats.types.js";

afterEach(() => document.body.replaceChildren());

const seat = (over: Partial<SeatModel> = {}): SeatModel => ({
  index: 1,
  deckId: "precon:core-spider-man-justice",
  frame: "activeFilled",
  label: "SEAT 1 · YOU",
  name: "Spider-Man",
  meta: "Justice · 10 HP · hand 5",
  empty: null,
  picture: null,
  clearLabel: "Clear seat 1",
  ...over,
});

async function mount(model: SeatModel): Promise<McSeatCard> {
  const card = document.createElement("mc-seat-card") as McSeatCard;
  card.model = model;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

const stops = (card: McSeatCard): string[] =>
  [...card.shadowRoot!.querySelectorAll<HTMLElement>("[data-stop]")].map((part) => part.dataset.stop!);

describe("mc-seat-card", () => {
  it("shows the label, name and meta of a filled seat, with its stop and its clear stop named by the deck", async () => {
    const card = await mount(seat());
    expect(card.shadowRoot!.querySelector(".label")!.textContent).toBe("SEAT 1 · YOU");
    expect(card.shadowRoot!.querySelector(".name")!.textContent).toBe("Spider-Man");
    expect(card.shadowRoot!.querySelector(".meta")!.textContent).toBe("Justice · 10 HP · hand 5");
    expect(stops(card)).toEqual(["seat:1", "seat-clear:precon:core-spider-man-justice"]);
  });

  it("says what an empty seat says and has no clear stop", async () => {
    const card = await mount(seat({ index: 2, deckId: null, frame: "empty", name: null, meta: null, empty: "Empty" }));
    expect(card.shadowRoot!.querySelector(".empty")!.textContent).toBe("Empty");
    expect(stops(card)).toEqual(["seat:2"]);
  });

  it("is no stop at all while the seat cannot be reached yet", async () => {
    const card = await mount(seat({ frame: "locked", deckId: null, name: null, empty: "Fill seat 2 first" }));
    expect(stops(card)).toEqual([]);
    expect(card.shadowRoot!.querySelector(".face")!.getAttribute("data-frame")).toBe("locked");
  });

  it("raises one typed event per press, from a keyboard click on a stop", async () => {
    const card = await mount(seat());
    const seen: SeatsEvent[] = [];
    card.addEventListener("mc-seats", (event) => seen.push((event as CustomEvent<SeatsEvent>).detail));
    card.shadowRoot!.querySelector<HTMLElement>('[data-stop="seat:1"]')!.click();
    card.shadowRoot!.querySelector<HTMLElement>('[data-stop^="seat-clear:"]')!.click();
    expect(seen).toEqual([
      { type: "seat", index: 1 },
      { type: "clear", index: 1, deckId: "precon:core-spider-man-justice" },
    ]);
  });
});
