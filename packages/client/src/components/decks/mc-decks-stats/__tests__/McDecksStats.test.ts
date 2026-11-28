// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-decks-stats.js";
import type { McDecksStats } from "../McDecksStats.js";
import type { DecksDeckStatsModel, DecksEvent, DecksStatsModel } from "../../decks.types.js";

afterEach(() => document.body.replaceChildren());

const deck = (over: Partial<DecksDeckStatsModel> = {}): DecksDeckStatsModel => ({
  kind: "deck",
  title: "HAWKEYE / LEADERSHIP",
  meta: "40 CARDS · LEGAL",
  credit: null,
  mode: "deck",
  tabs: [
    { action: "pane-deck", label: "This deck", selected: true },
    { action: "pane-games", label: "From your games", selected: false },
  ],
  deck: {
    curveHeading: "COST CURVE · AVG 2.1",
    bars: [
      { label: "0", count: 2, highlight: false },
      { label: "1", count: 9, highlight: true },
    ],
    compositionHeading: "COMPOSITION",
    tiles: [
      { label: "Allies", count: 6 },
      { label: "Events", count: 14 },
    ],
    actions: [
      { action: "stats-check", label: "Check" },
      { action: "stats-edit", label: "Edit" },
    ],
    recentlyHeading: "RECENTLY CHANGED",
    recently: "Last changed 1/2/2026",
  },
  games: null,
  card: null,
  footer: {
    duplicate: { action: "stats-duplicate", label: "Duplicate" },
    play: { action: "stats-play", label: "Play this deck ▸" },
  },
  ...over,
});

async function mount(model: DecksStatsModel): Promise<McDecksStats> {
  const element = document.createElement("mc-decks-stats") as McDecksStats;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-decks-stats", () => {
  it("draws the title, the curve, a tile per composition count and the pinned Duplicate and Play", async () => {
    const element = await mount(deck());
    const root = element.shadowRoot!;
    expect(root.querySelector(".title")!.textContent).toBe("HAWKEYE / LEADERSHIP");
    expect(root.querySelector("mc-bar-chart")).not.toBeNull();
    const tiles = [...root.querySelectorAll("mc-stat-tile")].map(
      (tile) => (tile as HTMLElement & { text: string }).text,
    );
    expect(tiles).toEqual(["Allies 6", "Events 14"]);
    const seen: DecksEvent[] = [];
    element.addEventListener("mc-decks", (event) => seen.push((event as CustomEvent<DecksEvent>).detail));
    root.querySelector<HTMLElement>('[data-stop="stats-play"]')!.click();
    root.querySelector<HTMLElement>('[data-stop="pane:games"]')!.click();
    expect(seen).toEqual([
      { type: "action", action: "stats-play" },
      { type: "action", action: "pane-games" },
    ]);
  });

  it("swaps the body for the games view or a card view, drops the tabs under a card, and says so with no deck", async () => {
    const element = await mount(
      deck({
        mode: "games",
        games: {
          reading: "Reading…",
          headline: null,
          insight: null,
          blocks: [],
          open: { action: "games-open", label: "Edit" },
        },
      }),
    );
    const root = element.shadowRoot!;
    expect(root.querySelector("mc-decks-games")).not.toBeNull();
    expect(root.querySelector("mc-bar-chart")).toBeNull();
    element.model = deck({
      mode: "card",
      card: {
        cardId: "01001",
        back: { action: "card-back", label: "Back" },
        inspect: { action: "card-inspect", label: "Inspect" },
        picture: { src: null },
        name: "Web-Swing",
        typeLine: "EVENT",
        blocks: [],
        inDecksHeading: "In decks",
        inDecks: [],
      },
    });
    await element.updateComplete;
    expect(root.querySelector("mc-decks-card-view")).not.toBeNull();
    expect(root.querySelector(".tabs")).toBeNull();
    element.model = { kind: "empty", text: "Select a deck." };
    await element.updateComplete;
    expect(root.querySelector(".select")!.textContent).toBe("Select a deck.");
  });
});
