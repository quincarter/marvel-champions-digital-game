import { describe, expect, it } from "vitest";
import "./mc-deck-grid.js";
import type { DeckGridItem, DeckGridModel } from "./mc-deck-grid.types.js";

const item = (id: string, over: Partial<DeckGridItem> = {}): DeckGridItem => ({
  id,
  cardId: `card-${id}`,
  picture: { src: null, missing: "no picture" },
  lines: [{ text: `Deck ${id}`, size: 14, height: 19 }],
  stripe: ["#c62828"],
  heavy: false,
  ...over,
});

const model = (over: Partial<DeckGridModel> = {}): DeckGridModel => ({
  mode: "grid",
  columns: 2,
  gap: 10,
  artHeight: 100,
  contentWidth: 300,
  items: [item("a"), item("b")],
  emptyText: null,
  loading: false,
  ...over,
});

async function grid(m: DeckGridModel): Promise<HTMLElementTagNameMap["mc-deck-grid"]> {
  const el = document.createElement("mc-deck-grid");
  el.model = m;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-deck-grid", () => {
  it("draws a tile a deck, finds each by its key and names the hero pictures for a hover popover", async () => {
    const el = await grid(model());
    expect(el.elementOf("deck:a")?.tagName).toBe("MC-PICTURE-CARD");
    expect(el.elementOf("deck:b")).toBeTruthy();
    expect(el.hoverFaces().map((face) => face.cardId)).toEqual(["card-a", "card-b"]);
    el.remove();
  });

  it("draws a row a deck with a Pick button that still raises mc-activate while dimmed", async () => {
    const el = await grid(
      model({
        mode: "list",
        items: [item("a", { pick: { label: "Pick", look: "secondary", disabled: "Not legal" } })],
      }),
    );
    const keys: string[] = [];
    el.addEventListener("mc-activate", (event) => keys.push((event as CustomEvent<{ key: string }>).detail.key));
    const pick = el.elementOf("pick:a") as HTMLElement & { updateComplete: Promise<boolean> };
    await pick.updateComplete;
    expect(pick.hasAttribute("disabled") && pick.hasAttribute("pressable")).toBe(true);
    pick.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1 }),
    );
    pick.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1 }),
    );
    expect(keys).toEqual(["pick:a"]);
    el.remove();
  });

  it("says its words in place of the decks", async () => {
    const el = await grid(model({ items: [], emptyText: "No deck matches that." }));
    expect((el.shadowRoot!.querySelector("mc-empty-state") as { message: string }).message).toBe(
      "No deck matches that.",
    );
    expect(el.elementOf("deck:a")).toBeNull();
    el.remove();
  });
});
