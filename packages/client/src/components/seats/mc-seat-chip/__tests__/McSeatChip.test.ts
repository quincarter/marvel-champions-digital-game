// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-seat-chip.js";
import type { McSeatChip } from "../McSeatChip.js";
import type { SeatModel, SeatsEvent } from "../../seats.types.js";

afterEach(() => document.body.replaceChildren());

const seat = (over: Partial<SeatModel> = {}): SeatModel => ({
  index: 0,
  deckId: "precon:core-spider-man-justice",
  frame: "activeFilled",
  label: "SEAT 1 · YOU",
  name: "Spider-Man",
  meta: "Justice · 10 HP · hand 5",
  empty: null,
  picture: null,
  clearLabel: "Clear seat 1",
  chip: { label: "SEAT 1", meta: "Justice · 10 HP", empty: null },
  ...over,
});

async function mount(model: SeatModel): Promise<McSeatChip> {
  const chip = document.createElement("mc-seat-chip") as McSeatChip;
  chip.model = model;
  document.body.append(chip);
  await chip.updateComplete;
  return chip;
}

const root = (chip: McSeatChip): ShadowRoot => chip.shadowRoot!;

describe("mc-seat-chip", () => {
  it("shows the chip's short words, not the card's, and has no clear control", async () => {
    const chip = await mount(seat());
    expect(root(chip).querySelector(".label")!.textContent).toBe("SEAT 1");
    expect(root(chip).querySelector(".name")!.textContent).toBe("Spider-Man");
    expect(root(chip).querySelector(".meta")!.textContent).toBe("Justice · 10 HP");
    expect([...root(chip).querySelectorAll<HTMLElement>("[data-stop]")].map((part) => part.dataset.stop)).toEqual([
      "seat:0",
    ]);
  });

  it("falls back to the card's words when the model has no chip words", async () => {
    const chip = await mount(seat({ chip: { label: "SEAT 1 · YOU", meta: "Justice · 10 HP · hand 5", empty: null } }));
    expect(root(chip).querySelector(".label")!.textContent).toBe("SEAT 1 · YOU");
    expect(root(chip).querySelector(".meta")!.textContent).toBe("Justice · 10 HP · hand 5");
  });

  it("says Picking on the active empty seat, and is no stop on a locked one", async () => {
    const picking = await mount(
      seat({
        index: 1,
        deckId: null,
        frame: "activeEmpty",
        name: null,
        chip: { label: "SEAT 2", meta: null, empty: "Picking" },
      }),
    );
    expect(root(picking).querySelector(".empty")!.textContent).toBe("Picking");
    expect(root(picking).querySelector(".face")!.getAttribute("data-frame")).toBe("activeEmpty");
    document.body.replaceChildren();
    const locked = await mount(
      seat({
        index: 2,
        deckId: null,
        frame: "locked",
        name: null,
        chip: { label: "SEAT 3", meta: null, empty: "Empty" },
      }),
    );
    expect(root(locked).querySelectorAll("[data-stop]").length).toBe(0);
  });

  it("raises the seat event from a keyboard click on its stop", async () => {
    const chip = await mount(seat({ index: 3 }));
    const seen: SeatsEvent[] = [];
    chip.addEventListener("mc-seats", (event) => seen.push((event as CustomEvent<SeatsEvent>).detail));
    root(chip).querySelector<HTMLElement>('[data-stop="seat:3"]')!.click();
    expect(seen).toEqual([{ type: "seat", index: 3 }]);
  });
});
