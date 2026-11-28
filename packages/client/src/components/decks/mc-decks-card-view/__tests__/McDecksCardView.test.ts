// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-decks-card-view.js";
import type { McDecksCardView } from "../McDecksCardView.js";
import type { DecksCardViewModel, DecksEvent } from "../../decks.types.js";

afterEach(() => document.body.replaceChildren());

const view = (over: Partial<DecksCardViewModel> = {}): DecksCardViewModel => ({
  cardId: "01001",
  back: { action: "card-back", label: "◂ Deck stats" },
  inspect: { action: "card-inspect", label: "Inspect" },
  picture: { src: null },
  name: "Web-Swing",
  typeLine: "EVENT",
  blocks: [
    { title: "With Spider-Man", lines: [{ label: "Played", value: "12" }], empty: "" },
    { title: "Every hero", lines: null, empty: "Not played yet." },
  ],
  inDecksHeading: "In your decks",
  inDecks: ["Spider-Man (Justice)"],
  ...over,
});

async function mount(model: DecksCardViewModel): Promise<McDecksCardView> {
  const element = document.createElement("mc-decks-card-view") as McDecksCardView;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-decks-card-view", () => {
  it("shows the card, what the games say about it and the decks that hold it", async () => {
    const element = await mount(view());
    const root = element.shadowRoot!;
    expect(root.querySelector(".name")!.textContent).toBe("Web-Swing");
    expect(root.querySelector("dd")!.textContent).toBe("12");
    expect(root.querySelector(".empty")!.textContent).toBe("Not played yet.");
    expect(root.querySelector("li")!.textContent).toBe("Spider-Man (Justice)");
  });

  it("raises its way back and Inspect from their stops, and leaves out an empty decks list", async () => {
    const element = await mount(view({ inDecks: [] }));
    const root = element.shadowRoot!;
    expect(root.querySelector("ul")).toBeNull();
    const seen: DecksEvent[] = [];
    element.addEventListener("mc-decks", (event) => seen.push((event as CustomEvent<DecksEvent>).detail));
    root.querySelector<HTMLElement>('[data-stop="card-back"]')!.click();
    root.querySelector<HTMLElement>('[data-stop="card-inspect"]')!.click();
    expect(seen).toEqual([
      { type: "action", action: "card-back" },
      { type: "action", action: "card-inspect" },
    ]);
  });
});
