// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-decks-header.js";
import type { McDecksHeader } from "../McDecksHeader.js";
import type { DecksEvent, DecksHeaderModel } from "../../decks.types.js";

afterEach(() => document.body.replaceChildren());

const bar: DecksHeaderModel = {
  backLabel: "Back",
  title: "Decks & Collection",
  poolMeta: "CARD POOL · 612 CARDS",
  statsLabel: "Your stats",
  titleDrop: 0,
  titleMaxRight: null,
};

async function mount(model: DecksHeaderModel): Promise<McDecksHeader> {
  const element = document.createElement("mc-decks-header") as McDecksHeader;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-decks-header", () => {
  it("shows the title and the pool size, and raises back and player-stats from their stops", async () => {
    const element = await mount(bar);
    const root = element.shadowRoot!;
    expect(root.querySelector(".title")!.textContent!.trim()).toBe("Decks & Collection");
    expect(root.querySelector(".meta")!.textContent).toBe("CARD POOL · 612 CARDS");
    const seen: DecksEvent[] = [];
    element.addEventListener("mc-decks", (event) => seen.push((event as CustomEvent<DecksEvent>).detail));
    root.querySelector<HTMLElement>('[data-stop="back"]')!.click();
    root.querySelector<HTMLElement>('[data-stop="player-stats"]')!.click();
    expect(seen).toEqual([
      { type: "action", action: "back" },
      { type: "action", action: "player-stats" },
    ]);
  });

  it("leaves the pool size out on a phone and draws a glyph only while the scene gives one", async () => {
    const element = await mount({ ...bar, poolMeta: null });
    expect(element.shadowRoot!.querySelector(".meta")).toBeNull();
    expect(element.shadowRoot!.querySelector("mc-glyph-hint")).toBeNull();
    element.model = { ...bar, backGlyph: { specs: [], height: 20, ground: "ink", openness: 1 } };
    await element.updateComplete;
    expect(element.shadowRoot!.querySelectorAll("mc-glyph-hint")).toHaveLength(1);
  });
});
