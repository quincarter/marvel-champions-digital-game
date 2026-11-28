// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-seats-footer.js";
import type { McSeatsFooter } from "../McSeatsFooter.js";
import type { SeatsEvent, SeatsFooterModel } from "../../seats.types.js";

afterEach(() => document.body.replaceChildren());

const foot = (over: Partial<SeatsFooterModel> = {}): SeatsFooterModel => ({
  deckCheckLabel: "Deck check ▸",
  playLabel: "Play 2 heroes ▸",
  playBlocked: null,
  deckCheckBlocked: null,
  ...over,
});

async function mount(model: SeatsFooterModel): Promise<McSeatsFooter> {
  const element = document.createElement("mc-seats-footer") as McSeatsFooter;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

const stops = (element: McSeatsFooter): string[] =>
  [...element.shadowRoot!.querySelectorAll<HTMLElement>("[data-stop]")]
    .map((part) => part.dataset.stop!)
    .filter((key) => key !== "");

describe("mc-seats-footer", () => {
  it("raises play and deck-check from their stops", async () => {
    const element = await mount(foot());
    const seen: SeatsEvent[] = [];
    element.addEventListener("mc-seats", (event) => seen.push((event as CustomEvent<SeatsEvent>).detail));
    expect(stops(element)).toEqual(["deck-check", "play"]);
    element.shadowRoot!.querySelector<HTMLElement>('[data-stop="deck-check"]')!.click();
    element.shadowRoot!.querySelector<HTMLElement>('[data-stop="play"]')!.click();
    expect(seen).toEqual([
      { type: "action", action: "deck-check" },
      { type: "action", action: "play" },
    ]);
  });

  it("with no hero has no stops, a disabled Deck check with its reason, and a Play that still explains itself", async () => {
    const element = await mount(
      foot({ playLabel: "Pick a hero", playBlocked: "Pick a hero first", deckCheckBlocked: "Pick a hero first" }),
    );
    expect(stops(element)).toEqual([]);
    const deck = element.shadowRoot!.querySelector<HTMLElement>(".deck-check")!;
    expect(deck.hasAttribute("disabled")).toBe(true);
    expect(deck.title).toBe("Pick a hero first");
    const play = element.shadowRoot!.querySelector<HTMLElement>(".play")!;
    expect(play.getAttribute("aria-disabled")).toBe("true");
    const seen: SeatsEvent[] = [];
    element.addEventListener("mc-seats", (event) => seen.push((event as CustomEvent<SeatsEvent>).detail));
    play.click();
    expect(seen).toEqual([{ type: "action", action: "play" }]);
  });

  it("stacks when wide and draws the Play glyph only when given", async () => {
    const element = await mount(foot());
    element.wide = true;
    await element.updateComplete;
    expect(element.hasAttribute("wide")).toBe(true);
    expect(element.shadowRoot!.querySelector("mc-glyph")).toBeNull();
    element.model = foot({ playGlyph: { specs: [], height: 20, ground: "ink", openness: 1 } });
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector("mc-glyph")).not.toBeNull();
  });
});
