// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-decks-pool-cell.js";
import type { McDecksPoolCell } from "../McDecksPoolCell.js";
import type { DecksPoolCard } from "../../decks.types.js";

afterEach(() => document.body.replaceChildren());

const card = (over: Partial<DecksPoolCard> = {}): DecksPoolCard => ({
  cardId: "01001",
  picture: { src: "/a.png" },
  title: "Web-Swing",
  cost: 2,
  caption: "Event · 1 of 3 in deck",
  quantity: 1,
  shown: false,
  ...over,
});

async function mount(model: DecksPoolCard): Promise<McDecksPoolCell> {
  const element = document.createElement("mc-decks-pool-cell") as McDecksPoolCell;
  element.card = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-decks-pool-cell", () => {
  it("shows the name, the cost pip and the copies in the deck, with the heavier frame", async () => {
    const element = await mount(card());
    const root = element.shadowRoot!;
    expect(root.querySelector(".title")!.textContent).toBe("Web-Swing");
    expect(root.querySelector(".pip")!.textContent).toBe("2");
    expect(root.querySelector(".held")!.textContent).toBe("×1");
    expect(root.querySelector(".frame")!.getAttribute("data-held")).toBe("true");
  });

  it("leaves out the pip of a card with no cost and the mark of one the deck does not hold, and presses with its id", async () => {
    const element = await mount(card({ cost: null, quantity: 0 }));
    const root = element.shadowRoot!;
    expect(root.querySelector(".pip")).toBeNull();
    expect(root.querySelector(".held")).toBeNull();
    expect(root.querySelector(".frame")!.getAttribute("data-held")).toBe("false");
    const seen: unknown[] = [];
    element.addEventListener("mc-pressed", (event) => seen.push((event as CustomEvent).detail));
    element.click();
    expect(seen).toEqual([{ action: "01001", hold: false }]);
  });
});
