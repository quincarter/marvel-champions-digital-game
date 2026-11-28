// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-decks-page.js";
import type { McDecksPage } from "../McDecksPage.js";
import type { DecksEvent, DecksPageModel } from "../../../../components/decks/decks.types.js";

afterEach(() => document.body.replaceChildren());

const page = (over: Partial<DecksPageModel> = {}): DecksPageModel => ({
  wide: true,
  phone: false,
  tab: "decks",
  tabs: [
    { id: "decks", label: "Decks" },
    { id: "cards", label: "Cards" },
    { id: "stats", label: "Stats" },
  ],
  header: {
    backLabel: "Back",
    title: "Decks",
    poolMeta: null,
    statsLabel: "Your stats",
    titleDrop: 0,
    titleMaxRight: null,
  },
  list: {
    heading: "Your decks",
    newDeckLabel: "+ New deck",
    status: null,
    search: { text: "", placeholder: "", clearLabel: "" },
    filtersLabel: "Filters",
    filtersOpen: false,
    chips: [],
    rows: [],
    empty: null,
    rowHeight: 84,
    reveal: null,
    topKey: 0,
    io: {
      heading: "",
      description: "",
      open: null,
      pasteText: "",
      marvelcdbText: "",
      busy: false,
      pasteLabel: "Paste",
      cdbLabel: "CDB",
      exportLabel: "Export",
      exportDisabled: null,
      pastePlaceholder: "",
      linkPlaceholder: "",
      importListLabel: "",
      importCdbLabel: "",
      importingLabel: "",
    },
  },
  cards: {
    title: "Card pool",
    chips: [],
    foldable: null,
    search: null,
    empty: "Select a deck.",
    cardIds: [],
    cardAt: () => {
      throw new Error("no cards");
    },
    topKey: 0,
    cardScale: 1,
    version: "",
  },
  stats: { kind: "empty", text: "Select a deck." },
  ...over,
});

async function mount(model: DecksPageModel): Promise<McDecksPage> {
  const element = document.createElement("mc-decks-page") as McDecksPage;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-decks-page", () => {
  it("composes the three panes side by side when wide, and nothing else", async () => {
    const element = await mount(page());
    const root = element.shadowRoot!;
    expect(root.querySelector("mc-decks-header")).not.toBeNull();
    expect(root.querySelector("mc-decks-list")).not.toBeNull();
    expect(root.querySelector("mc-decks-cards")).not.toBeNull();
    expect(root.querySelector("mc-decks-stats")).not.toBeNull();
    expect(root.querySelector("mc-tab-rail")).toBeNull();
    expect(element.hasAttribute("wide")).toBe(true);
  });

  it("shows one pane behind the tab rail when narrow, and raises the tab a cell names", async () => {
    const element = await mount(page({ wide: false, tab: "cards" }));
    const root = element.shadowRoot!;
    expect(root.querySelector("mc-tab-rail")).not.toBeNull();
    expect(root.querySelector("mc-decks-cards")).not.toBeNull();
    expect(root.querySelector("mc-decks-list")).toBeNull();
    expect(root.querySelector("mc-decks-stats")).toBeNull();
    const seen: DecksEvent[] = [];
    element.addEventListener("mc-decks", (event) => seen.push((event as CustomEvent<DecksEvent>).detail));
    root
      .querySelector("mc-tab-rail")!
      .dispatchEvent(
        new CustomEvent("mc-activate", { detail: { id: "stats", key: "tab:stats" }, bubbles: true, composed: true }),
      );
    expect(seen).toEqual([{ type: "tab", tab: "stats" }]);
    expect(element.section("mc-decks-cards")).not.toBeNull();
  });
});
