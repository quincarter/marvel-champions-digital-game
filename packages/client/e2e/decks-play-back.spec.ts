import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, pressHookStop, settle, waitFor } from "./helpers.js";
import { hook, openApp, type Rect } from "./wave6-helpers-b.js";

/**
 * The Decks screen's two navigation reports (2026-10-12): "+ New deck" is always in view on the pane's header, never
 * the list's last row, and backing out of "Play this deck" (Take your seats -> Scenarios -> Title) lands on Title and
 * stays there, rather than Title replaying the hand-off and bouncing back to Take your seats.
 */

interface Stop extends Rect {
  readonly key: string;
}

const waitForScene = (page: Page, scene: string): Promise<true> =>
  waitFor(async () => ((await activeScenes(page)).includes(scene) ? true : null), `scene ${scene}`, 30000);

async function openDecks(page: Page): Promise<void> {
  await clickText(page, "Decks", { sceneKey: "Title" });
  await waitForScene(page, "Decks");
  await waitFor(
    async () => ((await hook<Stop[]>(page, "__mcDecksDebug", "stops")) ?? []).find((s) => s.key === "new-deck") ?? null,
    "the New deck button",
  );
}

test.describe("Decks screen navigation", () => {
  test("+ New deck sits above the deck list, in view without scrolling", async ({ page }) => {
    await openApp(page);
    await openDecks(page);
    const stops = (await hook<Stop[]>(page, "__mcDecksDebug", "stops")) ?? [];
    const newDeck = stops.find((s) => s.key === "new-deck")!;
    const search = stops.find((s) => s.key === "deck-search")!;
    expect(newDeck.y + newDeck.height, "New deck is above the search field").toBeLessThanOrEqual(search.y);
    await pressHookStop(page, "__mcDecksDebug", "new-deck");
    await waitForScene(page, "DeckBuilder");
  });

  test("backing out of Play this deck reaches Title and stays there", async ({ page }) => {
    await openApp(page);
    await openDecks(page);
    await pressHookStop(page, "__mcDecksDebug", "stats-play");
    // The scenario first (#958), then Take your seats with the deck in seat one; back out of both.
    await waitForScene(page, "ScenarioSelect");
    await settle(page);
    await pressHookStop(page, "__mcScenarioSelectDebug", "scenario:rhino");
    await pressHookStop(page, "__mcScenarioSelectDebug", "next");
    await waitForScene(page, "Seats");
    await settle(page);
    await pressHookStop(page, "__mcSeatsDebug", "back");
    await waitForScene(page, "ScenarioSelect");
    await settle(page);
    await pressHookStop(page, "__mcScenarioSelectDebug", "back");
    await waitForScene(page, "Title");
    await settle(page, { maxMs: 2500 });
    expect(await activeScenes(page), "Title is still up, not Take your seats").toContain("Title");
    expect(await activeScenes(page)).not.toContain("Seats");
    // Title's own menu works: Decks opens again.
    await openDecks(page);
  });
});
