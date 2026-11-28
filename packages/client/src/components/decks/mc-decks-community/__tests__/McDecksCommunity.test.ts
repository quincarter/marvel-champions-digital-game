// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-decks-community.js";
import type { McDecksCommunity } from "../McDecksCommunity.js";
import type { DecksCommunityModel, DecksEvent } from "../../decks.types.js";

afterEach(() => document.body.replaceChildren());

const deck = (over: Partial<DecksCommunityModel> = {}): DecksCommunityModel => ({
  kind: "community",
  from: "From MarvelCDB",
  name: "Hawkeye Tempo",
  credit: "by Someone",
  stamps: [
    { text: "Leadership", fill: "#3f8", ink: "#000" },
    { text: "✓ Tested", fill: "#fff", ink: "#000" },
  ],
  meta: "HAWKEYE · 40 CARDS",
  why: null,
  notesHeading: "How it plays",
  notes: "Draw, then shoot.",
  noNotes: "The author left no notes.",
  scrollCue: "Scroll",
  url: "marvelcdb.com/decklist/view/1",
  links: [
    { action: "stats-copy-link", label: "Copy link" },
    { action: "stats-open-link", label: "MarvelCDB ↗" },
  ],
  check: { action: "stats-check", label: "Check" },
  add: { action: "stats-add", label: "Add to my decks" },
  ...over,
});

async function mount(model: DecksCommunityModel): Promise<McDecksCommunity> {
  const element = document.createElement("mc-decks-community") as McDecksCommunity;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-decks-community", () => {
  it("shows the author, the stamps, the notes and the link, and presses Check and Add from their stops", async () => {
    const element = await mount(deck());
    const root = element.shadowRoot!;
    expect(root.querySelector(".name")!.textContent).toBe("Hawkeye Tempo");
    expect(root.querySelectorAll(".stamp")).toHaveLength(2);
    expect(root.querySelector(".notes")!.textContent!.trim()).toBe("Draw, then shoot.");
    expect(root.querySelector(".url")!.textContent).toBe("marvelcdb.com/decklist/view/1");
    const seen: DecksEvent[] = [];
    element.addEventListener("mc-decks", (event) => seen.push((event as CustomEvent<DecksEvent>).detail));
    root.querySelector<HTMLElement>('[data-stop="stats-check"]')!.click();
    root.querySelector<HTMLElement>('[data-stop="stats-add"]')!.click();
    expect(seen).toEqual([
      { type: "action", action: "stats-check" },
      { type: "action", action: "stats-add" },
    ]);
  });

  it("leads a reason it cannot be added with a mark, and says so when the author left no notes", async () => {
    const element = await mount(deck({ why: "Needs the Rise of Red Skull.", notes: "" }));
    const root = element.shadowRoot!;
    expect(root.querySelector(".why")!.textContent).toContain("✕");
    expect(root.querySelector(".none")!.textContent).toBe("The author left no notes.");
  });
});
