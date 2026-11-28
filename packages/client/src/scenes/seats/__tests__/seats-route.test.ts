// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../../../views/seats/mc-seats-page/mc-seats-page.js";
import type { McSeatsPage } from "../../../views/seats/mc-seats-page/McSeatsPage.js";
import { collectStops, focusStopsOf } from "../../../dom/element-stops.js";
import type { SeatsPageModel } from "../../../components/seats/seats.types.js";
import { sheetRoute } from "../seats-order.js";

afterEach(() => document.body.replaceChildren());

const rect = () => ({ x: 0, y: 0, width: 10, height: 10 });

const model = (): SeatsPageModel => ({
  header: { backLabel: "Back", title: "Take your seats", step: "STEP 2 OF 4" },
  seats: [0, 1, 2, 3].map((index) => ({
    index,
    deckId: null,
    frame: index === 0 ? ("activeEmpty" as const) : ("empty" as const),
    label: `SEAT ${index + 1}`,
    name: null,
    meta: null,
    empty: "Empty",
    picture: null,
    clearLabel: null,
  })),
  pairs: [],
  summary: null,
  filters: {
    searchToggle: null,
    filtersButton: null,
    search: { visible: false, text: "", placeholder: "" },
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
  detail: { hero: null, seatNote: null, emptyText: "", insights: [] },
  footer: { deckCheckLabel: "Deck check", playLabel: "Play", playBlocked: null, deckCheckBlocked: null },
  decks: {
    title: "Pick a deck",
    subtitle: "2 decks",
    backLabel: "Back",
    decks: [],
  },
  wide: true,
});

describe("the route while the Pick a deck sheet is up", () => {
  it("has the sheet's Back and never the header's, so two stops never share the key `back`", async () => {
    const page = document.createElement("mc-seats-page") as McSeatsPage;
    page.model = model();
    document.body.append(page);
    await page.updateComplete;
    const sheet = page.shadowRoot!.querySelector<HTMLElement>("mc-hero-decks-sheet")!;
    await (sheet as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const header = page.shadowRoot!.querySelector("mc-top-bar")!;
    await (header as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    // Read from the whole page, the first `back` is the header's: that is why the scene reads the sheet alone.
    const pageBacks = collectStops(page).filter((stop) => stop.key === "back");
    expect(pageBacks.length).toBe(2);
    const whole = focusStopsOf(page, rect);
    expect(whole.has("back")).toBe(true);
    const route = sheetRoute(sheet, rect);
    expect(route.order.filter((key) => key === "back")).toEqual(["back"]);
    expect(route.order.some((key) => key.startsWith("seat:") || key === "play")).toBe(false);
    expect(collectStops(sheet).filter((stop) => stop.key === "back")).toHaveLength(1);
    // The sheet's Back is the one in the sheet, not the header's.
    expect(route.stops.get("back")).toBeDefined();
    expect(sheet.shadowRoot!.querySelector('[data-stop="back"]')).not.toBeNull();
    expect(header.shadowRoot!.querySelector('[data-stop="back"]')).not.toBeNull();
  });
});
