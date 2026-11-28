// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-hero-decks-sheet.js";
import type { McHeroDecksSheet } from "../McHeroDecksSheet.js";
import type { DeckRowModel, DecksSheetModel, SeatsEvent } from "../../seats.types.js";

afterEach(() => document.body.replaceChildren());

const deck = (id: string, over: Partial<DeckRowModel> = {}): DeckRowModel => ({
  deckId: id,
  name: `Deck ${id}`,
  source: "Precon · 40 cards",
  stamps: [{ label: "Justice", fill: "#f0c040", ink: "#111111" }],
  verdict: "✓ Legal",
  legal: true,
  picture: null,
  seatLabel: "Seat",
  disabled: null,
  cardId: "01001a",
  ...over,
});

const sheet = (over: Partial<DecksSheetModel> = {}): DecksSheetModel => ({
  title: "Spider-Man",
  subtitle: "3 decks. Pick the one this seat plays.",
  backLabel: "Back",
  decks: [deck("a"), deck("b", { disabled: "Needs 40 cards", legal: false, verdict: "Needs 40 cards" }), deck("c")],
  ...over,
});

async function mount(model: DecksSheetModel | null): Promise<{ el: McHeroDecksSheet; seen: SeatsEvent[] }> {
  const el = document.createElement("mc-hero-decks-sheet") as McHeroDecksSheet;
  el.model = model;
  const seen: SeatsEvent[] = [];
  el.addEventListener("mc-seats", (event) => seen.push((event as CustomEvent<SeatsEvent>).detail));
  document.body.append(el);
  await el.updateComplete;
  return { el, seen };
}

const rows = (el: McHeroDecksSheet): HTMLElement[] => [...el.shadowRoot!.querySelectorAll<HTMLElement>("mc-deck-row")];
const rowStop = (row: HTMLElement): HTMLElement => row.shadowRoot!.querySelector<HTMLElement>("[data-stop]")!;

describe("mc-hero-decks-sheet", () => {
  it("draws nothing without a model", async () => {
    const { el } = await mount(null);
    expect(el.shadowRoot!.querySelector(".box")).toBeNull();
  });

  it("has a scrim, the header, one row per deck and a Back stop", async () => {
    const { el } = await mount(sheet());
    expect(el.shadowRoot!.querySelector(".scrim")).not.toBeNull();
    const header = el.shadowRoot!.querySelector("mc-decks-sheet-header")!;
    expect(header.shadowRoot!.querySelector(".title")!.textContent).toBe("Spider-Man");
    expect(rows(el)).toHaveLength(3);
    expect(rows(el).map((row) => rowStop(row).dataset.stop)).toEqual(["deck:a", "deck:b", "deck:c"]);
    expect(el.shadowRoot!.querySelector("mc-button.back")!.getAttribute("data-stop")).toBe("back");
    expect(el.shadowRoot!.querySelector("mc-button.back")!.getAttribute("label")).toBe("Back");
    expect(el.shadowRoot!.querySelector(".box")!.getAttribute("aria-label")).toBe("Spider-Man");
  });

  it("raises one deck event for a Seat press, and not the row's own event", async () => {
    const { el, seen } = await mount(sheet());
    const rowEvents: Event[] = [];
    document.body.addEventListener("mc-deck-pick", (event) => rowEvents.push(event));
    rowStop(rows(el)[2]!).click();
    expect(seen).toEqual([{ type: "deck", deckId: "c" }]);
    expect(rowEvents).toEqual([]);
  });

  it("raises nothing for a deck that cannot be seated", async () => {
    const { el, seen } = await mount(sheet());
    rowStop(rows(el)[1]!).click();
    expect(seen).toEqual([]);
  });

  it("closes from Back, from the scrim and from Escape, and only then", async () => {
    const { el, seen } = await mount(sheet());
    el.shadowRoot!.querySelector<HTMLElement>('[data-stop="back"]')!.click();
    el.shadowRoot!.querySelector<HTMLElement>(".scrim")!.click();
    el.shadowRoot!.querySelector<HTMLElement>(".box")!.click();
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true }));
    expect(seen).toEqual([{ type: "decks-close" }, { type: "decks-close" }]);
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
    expect(seen).toHaveLength(3);
    expect(seen[2]).toEqual({ type: "decks-close" });
  });

  it("keeps a row's element across a redraw with the same decks, and follows a changed list", async () => {
    const { el } = await mount(sheet());
    const first = rows(el)[0]!;
    el.model = sheet({ decks: [deck("a"), deck("d")] });
    await el.updateComplete;
    expect(rows(el)).toHaveLength(2);
    expect(rows(el)[0]).toBe(first);
    expect(rowStop(rows(el)[1]!).dataset.stop).toBe("deck:d");
  });
});
