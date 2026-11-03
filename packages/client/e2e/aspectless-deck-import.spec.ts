import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, pressHookStop, settle, trackPageErrors, waitFor } from "./helpers.js";
import { dealToFirstTurn, gameFacts, hook, openApp, type Rect } from "./wave6-helpers-b.js";

/**
 * Issue #639: "Back to the Basics" (MarvelCDB decklist 68313, Miles Morales with only his identity set and basic cards)
 * records no aspect. It imports through the link field (the reply served by `page.route` from the fixture the cards
 * package's own test uses), shows as Legal with no aspect chosen, and is played to the first player turn.
 */

const ID = 68313;
const FIXTURE = fileURLToPath(
  new URL(`../../cards/src/playable/aspectless/marvelcdb-decklist-${ID}.json`, import.meta.url),
);

interface DeckRow {
  readonly source: string;
  readonly name: string;
  readonly status: string;
  readonly legal: boolean;
  readonly problems: string[];
  readonly cardCount: number;
}
interface Stop extends Rect {
  readonly key: string;
}

async function clickStop(page: Page, hookName: string, key: string): Promise<void> {
  await pressHookStop(page, hookName, key);
  await settle(page);
}

/** Presses a control every 2.5 s until one of the named scenes is up (a press during layout does nothing). */
async function pressUntilScene(page: Page, hookName: string, key: string, ...scenes: string[]): Promise<void> {
  let last = 0;
  await waitFor(
    async () => {
      if ((await activeScenes(page)).some((s) => scenes.includes(s))) return true;
      if (Date.now() - last > 2500) {
        last = Date.now();
        await clickStop(page, hookName, key);
      }
      return null;
    },
    `${scenes.join(" or ")} after "${key}"`,
    45000,
  );
}

const statusLine = (page: Page) => hook<{ text: string; tone: string }>(page, "__mcDecksDebug", "status");

test("a MarvelCDB decklist with no aspect (hero and basic cards only) imports, is legal, and plays", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = trackPageErrors(page);
  const body = readFileSync(FIXTURE, "utf8");
  let hits = 0;
  await page.route(`**/api/marvelcdb-import/decklist/${ID}`, (route) => {
    hits++;
    return route.fulfill({ status: 200, contentType: "application/json", body });
  });
  await openApp(page);
  await clickText(page, "Decks");
  await waitFor(async () => ((await activeScenes(page)).includes("Decks") ? true : null), "Decks opens", 8000);
  await settle(page);

  await clickStop(page, "__mcDecksDebug", "ie-marvelcdb-toggle");
  await clickStop(page, "__mcDecksDebug", "marvelcdb-field");
  await page.keyboard.type(`https://marvelcdb.com/decklist/view/${ID}/back-to-the-basics-1.0`);
  await settle(page);
  await clickStop(page, "__mcDecksDebug", "marvelcdb-import");
  await waitFor(async () => (await statusLine(page)) ?? null, "an import message", 10000);

  expect(hits, "the link field asked for that decklist").toBe(1);
  expect(await statusLine(page)).toEqual({ text: 'Imported "Back to the Basics".', tone: "success" });
  const decks = ((await hook<DeckRow[]>(page, "__mcDecksDebug", "decks")) ?? []).filter((d) => d.source === "imported");
  expect(decks).toHaveLength(1);
  const slots = (JSON.parse(body) as { slots: Record<string, number> }).slots;
  expect(decks[0]).toMatchObject({
    name: "Back to the Basics",
    status: "Legal",
    legal: true,
    problems: [],
    cardCount: Object.values(slots).reduce((sum, n) => sum + n, 0),
  });

  await clickText(page, "Play this deck", { sceneKey: "Decks", timeoutMs: 30000 });
  await waitFor(async () => ((await activeScenes(page)).includes("Seats") ? true : null), "Take your seats", 30000);
  await waitFor(
    async () =>
      ((await hook<Stop[]>(page, "__mcSeatsDebug", "stops")) ?? []).some((s) => s.key.startsWith("hero:"))
        ? true
        : null,
    "the hero list",
    30000,
  );
  await pressUntilScene(page, "__mcSeatsDebug", "play", "Setup");
  await pressUntilScene(page, "__mcTableSetupDebug", "deal-it-out", "SetupDeal", "ScenarioIntro");
  await dealToFirstTurn(page);
  const facts = await gameFacts<{ round: number; phase: string; hero: string }>(
    page,
    `(s) => ({ round: s.game.round, phase: s.game.step.phase,
      hero: s.game.cardPool[s.game.instances[s.game.players[0].identity.instanceId].cardId].name })`,
  );
  expect(facts).toMatchObject({ round: 1, phase: "player", hero: "Spider-Man" });
  expect(errors).toEqual([]);
});
