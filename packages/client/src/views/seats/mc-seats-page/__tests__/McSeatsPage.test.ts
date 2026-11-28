// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-seats-page.js";
import type { McSeatsPage } from "../McSeatsPage.js";
import type { SeatModel, SeatsEvent, SeatsPageModel } from "../../../../components/seats/seats.types.js";

afterEach(() => document.body.replaceChildren());

const seat = (index: number): SeatModel => ({
  index,
  deckId: index === 0 ? "d" : null,
  frame: index === 0 ? "activeFilled" : "empty",
  label: `SEAT ${index + 1}`,
  name: index === 0 ? "Spider-Man" : null,
  meta: null,
  empty: index === 0 ? null : "Empty",
  picture: null,
  clearLabel: index === 0 ? "Clear seat" : null,
});

const model = (over: Partial<SeatsPageModel> = {}): SeatsPageModel => ({
  header: { backLabel: "Back", title: "Take your seats", step: "STEP 2 OF 4" },
  seats: [0, 1, 2, 3].map(seat),
  pairs: [],
  summary: null,
  filters: {
    searchToggle: null,
    filtersButton: null,
    search: { visible: true, text: "", placeholder: "Search" },
    chips: [],
    rail: false,
    buttons: [],
    tip: null,
    tipChipId: null,
  },
  roster: {
    mode: "shelves",
    shelves: [],
    drillBack: null,
    emptyText: null,
    clearLabel: "Clear",
    previousLabel: "Previous",
    nextLabel: "Next",
    pagingHintShelf: null,
  },
  detail: { hero: null, seatNote: null, emptyText: "Select a hero below", insights: [] },
  footer: { deckCheckLabel: "Deck check", playLabel: "Play 1 hero", playBlocked: null, deckCheckBlocked: null },
  decks: null,
  wide: true,
  notice: null,
  ...over,
});

async function mount(page: SeatsPageModel): Promise<McSeatsPage> {
  const element = document.createElement("mc-seats-page") as McSeatsPage;
  element.model = page;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-seats-page", () => {
  it("composes the wide sections: cards, the detail column and the footer", async () => {
    const page = await mount(model());
    const root = page.shadowRoot!;
    for (const tag of [
      "mc-top-bar",
      "mc-seats-table",
      "mc-seats-filters",
      "mc-seats-roster",
      "mc-seats-detail",
      "mc-seats-footer",
    ])
      expect(root.querySelector(tag), tag).not.toBeNull();
    expect(page.hasAttribute("wide")).toBe(true);
    expect(root.querySelector("mc-seats-table")!.hasAttribute("compact")).toBe(false);
    expect(root.querySelector("mc-seats-footer")!.hasAttribute("wide")).toBe(true);
    expect(root.querySelector("mc-hero-decks-sheet")).toBeNull();
  });

  it("is one narrow column: chips, no detail column, a row footer", async () => {
    const page = await mount(model({ wide: false }));
    const root = page.shadowRoot!;
    expect(page.hasAttribute("wide")).toBe(false);
    expect(root.querySelector("mc-seats-detail")).toBeNull();
    expect(root.querySelector("mc-seats-table")!.hasAttribute("compact")).toBe(true);
    expect(root.querySelector("mc-seats-footer")!.hasAttribute("wide")).toBe(false);
  });

  it("shows the notice only with words, and the deck sheet only while it is open", async () => {
    const page = await mount(model({ notice: "1 card can't be played ▸" }));
    const root = page.shadowRoot!;
    expect(root.querySelector("mc-seats-notice")!.getAttribute("text")).toBeNull();
    expect((root.querySelector("mc-seats-notice") as unknown as { text: string }).text).toBe(
      "1 card can't be played ▸",
    );
    page.model = model({ decks: { title: "Pick a deck", subtitle: "2 decks", backLabel: "Back", decks: [] } });
    await page.updateComplete;
    expect(root.querySelector("mc-hero-decks-sheet")).not.toBeNull();
  });

  it("lets a section's mc-seats event bubble out of the page", async () => {
    const page = await mount(model());
    const seen: SeatsEvent[] = [];
    page.addEventListener("mc-seats", (event) => seen.push((event as CustomEvent<SeatsEvent>).detail));
    page.shadowRoot!.querySelector("mc-top-bar")!.shadowRoot!.querySelector<HTMLElement>('[data-stop="back"]')!.click();
    expect(seen).toEqual([{ type: "action", action: "back" }]);
  });
});
