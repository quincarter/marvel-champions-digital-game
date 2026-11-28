// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-decks-games.js";
import type { McDecksGames } from "../McDecksGames.js";
import type { DecksEvent, DecksGamesModel } from "../../decks.types.js";

afterEach(() => document.body.replaceChildren());

const games = (over: Partial<DecksGamesModel> = {}): DecksGamesModel => ({
  reading: null,
  headline: "7 games, 5 won",
  insight: "Your wins run long.",
  blocks: [
    {
      kind: "section",
      title: "Cut",
      entries: [{ cardId: "01001", name: "Web-Swing", detail: "lost 3 of 4", picture: { src: null } }],
    },
    { kind: "against", label: "Rhino ▸", enabled: true },
    { kind: "note", text: "Nothing stands out." },
  ],
  open: { action: "games-open", label: "Edit with these" },
  ...over,
});

async function mount(model: DecksGamesModel): Promise<McDecksGames> {
  const element = document.createElement("mc-decks-games") as McDecksGames;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-decks-games", () => {
  it("lists a section's cards with what the games say and raises the stepper and the open button", async () => {
    const element = await mount(games());
    const root = element.shadowRoot!;
    expect(root.querySelector(".headline")!.textContent).toBe("7 games, 5 won");
    expect(root.querySelector(".entry .name")!.textContent).toBe("Web-Swing");
    expect(root.querySelector(".note")!.textContent).toBe("Nothing stands out.");
    const seen: DecksEvent[] = [];
    element.addEventListener("mc-decks", (event) => seen.push((event as CustomEvent<DecksEvent>).detail));
    root.querySelector<HTMLElement>('[data-stop="games-against"]')!.click();
    root.querySelector<HTMLElement>('[data-stop="games-open"]')!.click();
    expect(seen).toEqual([
      { type: "action", action: "games-against" },
      { type: "action", action: "games-open" },
    ]);
  });

  it("says only that it is reading while the saves load", async () => {
    const element = await mount(games({ reading: "READING YOUR GAMES…" }));
    const root = element.shadowRoot!;
    expect(root.querySelector(".reading")!.textContent).toBe("READING YOUR GAMES…");
    expect(root.querySelector(".body")).toBeNull();
  });
});
