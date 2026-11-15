import { expect, test, type Page } from "@playwright/test";
import { activeScenes, settle, trackPageErrors, waitFor } from "./helpers.js";
import { clickStop, routeStops, waitForScene } from "./wave6-helpers-a.js";
import { declineMulligans, openApp, startGame } from "./wave6-helpers-b.js";

/**
 * Past games (#706): finished games are listed from the Title's "Past games" button with how they went, and one opens
 * as a replay from its details (a side panel on desktop, a popup on a phone); the replay's Exit comes back to the list.
 * On a phone, a swipe of the list that lifts over a row opens nothing; a tap opens the popup, and B closes it.
 */

const SHOTS = process.env.SHOT_DIR ?? "";

interface Saved {
  readonly id: string;
  readonly commandCount: number;
}

async function savedGames(page: Page): Promise<Saved[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("mc-saves", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const all = await new Promise<{ id: string; commandCount: number; createdAt: number }[]>((resolve) => {
      const request = db.transaction("games").objectStore("games").getAll();
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return all.sort((a, b) => a.createdAt - b.createdAt).map(({ id, commandCount }) => ({ id, commandCount }));
  });
}

/** Ends a saved game as a win, the way the engine's last write would mark it. */
async function markWon(page: Page, id: string): Promise<void> {
  await page.evaluate(async (gameId) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("mc-saves", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction("games", "readwrite");
    const store = tx.objectStore("games");
    const game = await new Promise<Record<string, unknown>>((resolve) => {
      const request = store.get(gameId);
      request.onsuccess = () => resolve(request.result);
    });
    store.put({ ...game, status: "won", outcome: { result: "win", reason: "villainDefeated" } });
    await new Promise((resolve) => (tx.oncomplete = resolve));
    db.close();
  }, id);
}

/** One real game with moves in its log (the mulligans), marked won. */
async function finishedGame(page: Page): Promise<Saved> {
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 43523 });
  await declineMulligans(page);
  await settle(page);
  const [game] = await savedGames(page);
  expect(game, "a game was saved").toBeTruthy();
  expect(game!.commandCount, "the game has moves to replay").toBeGreaterThan(0);
  await markWon(page, game!.id);
  await page.goto("/?unlock=all");
  await waitForScene(page, "Title", 30000);
  await settle(page, { quietMs: 500, maxMs: 3000 });
  return game!;
}

async function stopRect(page: Page, scene: string, key: string) {
  return waitFor(
    async () => (await routeStops(page, scene))?.stops.find((s) => s.key === key)?.rect ?? null,
    `${key} on ${scene}`,
  );
}

const center = (r: { x: number; y: number; width: number; height: number }) => ({
  x: r.x + r.width / 2,
  y: r.y + r.height / 2,
});

async function touchSwipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= 10; i++) {
    await page.waitForTimeout(16);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from.x + ((to.x - from.x) * i) / 10, y: from.y + ((to.y - from.y) * i) / 10, id: 1 }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

test("a finished game is listed from the Title and plays as a replay from its details; Exit comes back", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "the side panel is the desktop's case");
  test.setTimeout(300_000);
  const errors = trackPageErrors(page);
  const game = await finishedGame(page);

  await clickStop(page, "past-games", "Title");
  await waitForScene(page, "PastGames");
  await stopRect(page, "PastGames", `game:${game.id}`);
  // The side panel shows the newest game straight away, with its actions.
  await stopRect(page, "PastGames", "action:watch");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/past-games-desktop.png` });

  await clickStop(page, "action:watch", "PastGames");
  await waitFor(
    async () => ((await activeScenes(page)).includes("ReplayTransportOverlay") ? true : null),
    "the replay opens on the board",
    30000,
  );
  await settle(page, { quietMs: 500, maxMs: 3000 });
  await page.keyboard.press("Escape");
  await waitForScene(page, "PastGames", 30000);
  await stopRect(page, "PastGames", `game:${game.id}`);
  expect(errors).toEqual([]);
});

test("on a phone a swipe lifting over a row opens nothing; a tap opens the popup and B closes it", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "phone", "the touch release is the phone's case");
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 375, height: 667 });
  const errors = trackPageErrors(page);
  const game = await finishedGame(page);

  const button = center(await stopRect(page, "Title", "past-games"));
  await page.touchscreen.tap(button.x, button.y);
  await waitForScene(page, "PastGames");
  const row = center(await stopRect(page, "PastGames", `game:${game.id}`));
  const popupUp = async (): Promise<boolean> =>
    ((await routeStops(page, "PastGames"))?.stops ?? []).some((stop) => stop.key === "close");

  // Up from below the row, lifting on it: a scroll, not a press.
  await touchSwipe(page, { x: row.x, y: row.y + 220 }, row);
  await settle(page, { quietMs: 500, maxMs: 2500 });
  expect(await popupUp(), "a swipe opened nothing").toBe(false);

  await page.touchscreen.tap(row.x, row.y);
  await waitFor(async () => ((await popupUp()) ? true : null), "the popup opens");
  await stopRect(page, "PastGames", "action:watch");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/past-games-phone-popup.png` });
  await page.keyboard.press("Escape");
  await waitFor(async () => ((await popupUp()) ? null : true), "B closes the popup");
  expect(await activeScenes(page)).toContain("PastGames");
  expect(errors).toEqual([]);
});
