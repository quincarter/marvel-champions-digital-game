// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-decks-list.js";
import type { McDecksList } from "../McDecksList.js";
import type { DecksEvent, DecksListModel, McDeckRowModel } from "../../decks.types.js";

afterEach(() => document.body.replaceChildren());

const row = (deckId: string): McDeckRowModel => ({
  deckId,
  name: deckId,
  source: "",
  stamps: [],
  verdict: "",
  legal: true,
  picture: null,
  seatLabel: "",
  disabled: null,
  listing: { heading: deckId, src: null },
});

const list = (over: Partial<DecksListModel> = {}): DecksListModel => ({
  heading: "Your decks",
  newDeckLabel: "+ New deck",
  status: null,
  search: { text: "", placeholder: "search decks…", clearLabel: "Clear" },
  filtersLabel: "Filters",
  filtersOpen: false,
  chips: [],
  rows: [row("a"), row("b")],
  empty: null,
  rowHeight: 84,
  reveal: null,
  topKey: 0,
  io: {
    heading: "Import / Export",
    description: "",
    open: null,
    pasteText: "",
    marvelcdbText: "",
    busy: false,
    pasteLabel: "Paste",
    cdbLabel: "CDB link",
    exportLabel: "Export",
    exportDisabled: null,
    pastePlaceholder: "",
    linkPlaceholder: "",
    importListLabel: "Import",
    importCdbLabel: "Import",
    importingLabel: "Importing…",
  },
  ...over,
});

async function mount(model: DecksListModel): Promise<McDecksList> {
  const element = document.createElement("mc-decks-list") as McDecksList;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-decks-list", () => {
  it("draws a row per deck in the one scroller, with its status banner marked and the New deck button", async () => {
    const element = await mount(list({ status: { text: "Imported.", tone: "success" } }));
    const root = element.shadowRoot!;
    expect(root.querySelectorAll("mc-deck-row")).toHaveLength(2);
    expect(element.scroller).not.toBeNull();
    expect(root.querySelector(".status")!.textContent).toContain("✓");
    expect(root.querySelector('[data-stop="new-deck"]')).not.toBeNull();
  });

  it("raises a tap and an inspect of a row with its deck id, and says when no deck matches", async () => {
    const element = await mount(list());
    const seen: DecksEvent[] = [];
    element.addEventListener("mc-decks", (event) => seen.push((event as CustomEvent<DecksEvent>).detail));
    const first = element.shadowRoot!.querySelector("mc-deck-row")!;
    first.dispatchEvent(new CustomEvent("mc-deck-pick", { detail: { deckId: "a" }, bubbles: true, composed: true }));
    first.dispatchEvent(new CustomEvent("mc-deck-inspect", { detail: { deckId: "a" }, bubbles: true, composed: true }));
    expect(seen).toEqual([
      { type: "deck", deckId: "a", via: "press" },
      { type: "deck", deckId: "a", via: "inspect" },
    ]);
    element.model = list({ rows: [], empty: "No deck matches." });
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector(".empty")!.textContent).toBe("No deck matches.");
  });
});
