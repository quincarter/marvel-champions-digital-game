// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-decks-cards.js";
import type { McDecksCards } from "../McDecksCards.js";
import type { DecksCardsModel, DecksEvent } from "../../decks.types.js";

afterEach(() => document.body.replaceChildren());

const cards = (over: Partial<DecksCardsModel> = {}): DecksCardsModel => ({
  title: "Card pool",
  chips: [{ id: "basic", label: "Basic", selected: false }],
  foldable: null,
  search: { text: "", placeholder: "search cards…", clearLabel: "Clear" },
  empty: null,
  cardIds: ["a", "b"],
  cardAt: (index) => ({
    cardId: ["a", "b"][index]!,
    picture: { src: null },
    title: "T",
    cost: null,
    caption: "",
    quantity: 0,
    shown: false,
  }),
  topKey: 0,
  cardScale: 1,
  version: "v1",
  ...over,
});

async function mount(model: DecksCardsModel): Promise<McDecksCards> {
  const element = document.createElement("mc-decks-cards") as McDecksCards;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-decks-cards", () => {
  it("draws the chips beside the heading and the grid under the search", async () => {
    const element = await mount(cards());
    const root = element.shadowRoot!;
    expect(root.querySelector(".beside")).not.toBeNull();
    expect(root.querySelector(".below")).toBeNull();
    expect(root.querySelector('[data-stop="pool-chip:basic"]')).not.toBeNull();
    expect(root.querySelector('[data-stop="pool-search"]')).not.toBeNull();
    expect(element.grid).not.toBeNull();
  });

  it("folds the chips behind Filters on a phone, and says why there are no cards instead of a grid", async () => {
    const element = await mount(cards({ foldable: { label: "Filters", open: false }, empty: "No card matches." }));
    const root = element.shadowRoot!;
    expect(root.querySelector('[data-stop="pool-chip:filters"]')).not.toBeNull();
    expect(root.querySelector('[data-stop="pool-chip:basic"]')).toBeNull();
    expect(root.querySelector("mc-empty-state")).not.toBeNull();
    expect(element.grid).toBeNull();
    const seen: DecksEvent[] = [];
    element.addEventListener("mc-decks", (event) => seen.push((event as CustomEvent<DecksEvent>).detail));
    root.querySelector<HTMLElement>('[data-stop="pool-chip:filters"]')!.click();
    expect(seen).toEqual([{ type: "action", action: "pool-filters-toggle" }]);
    element.model = cards({ foldable: { label: "Filters", open: true } });
    await element.updateComplete;
    expect(root.querySelector('[data-stop="pool-chip:basic"]')).not.toBeNull();
  });
});
