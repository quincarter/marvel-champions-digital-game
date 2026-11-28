// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-extras-shelf.js";
import type { ExtrasTile } from "../mc-extras-shelf.types.js";

afterEach(() => document.body.replaceChildren());

const tile = (id: string, over: Partial<ExtrasTile> = {}): ExtrasTile => ({
  id,
  card: {
    src: null,
    focusY: 0.4,
    dim: false,
    chip: "READ ▸",
    chipTone: "action",
    title: id,
    detail: "",
    detailTone: "meta",
    initial: id.charAt(0),
  },
  ...over,
});

describe("mc-extras-shelf", () => {
  it("draws a tile per entry, each a focus stop, and says which was pressed", async () => {
    const el = document.createElement("mc-extras-shelf");
    el.tiles = [tile("story:one"), tile("story:two")];
    document.body.append(el);
    await el.updateComplete;
    const cards = [...el.shadowRoot!.querySelectorAll("mc-picture-card")];
    expect(cards.map((card) => (card as unknown as { stopKey: string }).stopKey)).toEqual([
      "tile:story:one",
      "tile:story:two",
    ]);
    const heard = vi.fn();
    el.addEventListener("mc-extras", (event) => heard(event.detail));
    cards[1]!.dispatchEvent(
      new CustomEvent("mc-activate", { detail: { key: "tile:story:two" }, bubbles: true, composed: true }),
    );
    expect(heard).toHaveBeenCalledWith({ type: "tile", id: "story:two" });
  });

  it("names the card of a promo tile so the hover popover can show it", async () => {
    const el = document.createElement("mc-extras-shelf");
    el.shape = "card";
    el.tiles = [tile("promo:spider-man", { cardId: "01001", promoSetId: "spider-man" })];
    document.body.append(el);
    await el.updateComplete;
    const card = el.shadowRoot!.querySelector("mc-picture-card")!;
    expect((card as unknown as { cardId: string }).cardId).toBe("01001");
    expect(card.getAttribute("data-promo-set")).toBe("spider-man");
    expect(el.getAttribute("shape")).toBe("card");
  });

  it("says why it is empty when it has a message", async () => {
    const el = document.createElement("mc-extras-shelf");
    el.empty = "Nothing here yet.";
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-empty-state")!.getAttribute("message")).toBe("Nothing here yet.");
  });
});
