import { describe, expect, it } from "vitest";
import "./mc-deck-details.js";
import type { DeckDetailsModel } from "./mc-deck-details.types.js";

const model = (over: Partial<DeckDetailsModel> = {}): DeckDetailsModel => ({
  cardId: "01001a",
  picture: { src: null, missing: "no picture" },
  artHeight: 110,
  contentWidth: 300,
  title: "Spider-Man",
  who: "Spider-Man · Justice",
  counts: "40 cards",
  status: null,
  missing: null,
  statsHeading: "Deck stats",
  cardsHeading: "Cards",
  bars: [{ label: "0", count: 3, highlight: true }],
  tileRows: [[{ id: "ally", text: "Allies 5" }]],
  groups: [{ label: "Hero · 1", entries: [{ name: "Backflip", quantity: 2, hover: "01010" }] }],
  use: { label: "Use this deck", look: "primary" },
  edit: { label: "Edit a copy", look: "secondary" },
  close: { label: "Close", look: "secondary" },
  ...over,
});

const pointer = (type: string): PointerEvent =>
  new PointerEvent(type, { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 });

async function panel(m: DeckDetailsModel) {
  const el = document.createElement("mc-deck-details");
  el.model = m;
  document.body.append(el);
  await el.updateComplete;
  const keys: string[] = [];
  el.addEventListener("mc-activate", (event) => keys.push((event as CustomEvent<{ key: string }>).detail.key));
  return { el, keys };
}

async function tap(el: HTMLElement): Promise<void> {
  await (el as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
  el.dispatchEvent(pointer("pointerdown"));
  el.dispatchEvent(pointer("pointerup"));
}

describe("mc-deck-details", () => {
  it("raises panel:use, panel:edit and panel:close from its footer", async () => {
    const { el, keys } = await panel(model());
    for (const key of ["panel:use", "panel:edit", "panel:close"]) await tap(el.elementOf(key)!);
    expect(keys).toEqual(["panel:use", "panel:edit", "panel:close"]);
    el.remove();
  });

  it("keeps a dimmed Use pressable, so the screen can say why it does nothing", async () => {
    const { el, keys } = await panel(
      model({ use: { label: "Use this deck", look: "secondary", disabled: "Needs 40 cards." } }),
    );
    const use = el.elementOf("panel:use")!;
    await (use as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
    expect(use.hasAttribute("disabled") && use.hasAttribute("pressable")).toBe(true);
    await tap(use);
    expect(keys).toEqual(["panel:use"]);
    el.remove();
  });

  it("leaves out Edit for a deck that cannot be edited, and names the picture and each card line for a hover popover", async () => {
    const { el } = await panel(model({ edit: null }));
    expect(el.elementOf("panel:edit")).toBeNull();
    expect(el.hoverFaces().map((face) => face.cardId)).toEqual(["01001a", "01010"]);
    el.remove();
  });
});
