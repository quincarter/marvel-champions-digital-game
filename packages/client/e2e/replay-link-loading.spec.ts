import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, installPageHelpers, waitForText } from "./helpers.js";
import { waitForScene } from "./wave6-helpers-a.js";
import { openApp, quietGuide } from "./wave6-helpers-b.js";
import { SYNC } from "./save-transfer-helpers.js";

/**
 * A shared replay's link (#858): the game opens on a loading screen for the replay, never the title menu, then the
 * versus screen, then the board. Cancel goes to the menu, and a replay that can't be loaded says why there, with Main
 * menu.
 */

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const ID = "abcdefghijkl";

async function openLink(page: Page, hash: string): Promise<void> {
  await installPageHelpers(page);
  await quietGuide(page);
  await page.goto(`/#replay=${hash}`);
}

test("a replay link loads on its own screen, and Cancel goes to the title menu", async ({ page }) => {
  // The replay service never answers: the loading screen stays up.
  await page.route(`${SYNC}/replay/**`, () => undefined);
  await openLink(page, ID);
  await waitForText(page, "Loading the shared replay", { timeoutMs: 30000 });
  expect(await activeScenes(page)).not.toContain("Title");
  await clickText(page, "CANCEL");
  await waitForScene(page, "Title");
});

test("an expired replay link says so, and Main menu goes to the title menu", async ({ page }) => {
  await page.route(`${SYNC}/replay/**`, (route) =>
    route.fulfill({
      status: 404,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "not-found", error: "not found" }),
    }),
  );
  await openLink(page, ID);
  await waitForText(page, "expired", { timeoutMs: 30000 });
  expect(await activeScenes(page)).not.toContain("Title");
  await clickText(page, "MAIN MENU");
  await waitForScene(page, "Title");
});

test("a replay link that names no replay says it isn't valid", async ({ page }) => {
  await openLink(page, "bad!");
  await waitForText(page, "isn't valid", { timeoutMs: 30000 });
  expect(await activeScenes(page)).not.toContain("Title");
});

/** A real two-hero game's replay file, made in the page: started through the store, then exported from its save. */
async function twoHeroReplay(page: Page): Promise<Buffer> {
  await openApp(page);
  const base64 = await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { start: (config: unknown) => Promise<void> } };
    };
    await appSession().store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-she-hulk-aggression" }],
      seed: 858,
    });
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("mc-saves", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    let games: { id: string; createdAt: number }[] = [];
    for (let tries = 0; tries < 50 && games.length === 0; tries++) {
      games = await new Promise((resolve) => {
        const request = db.transaction("games").objectStore("games").getAll();
        request.onsuccess = () => resolve(request.result as { id: string; createdAt: number }[]);
      });
      if (games.length === 0) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    db.close();
    const gameId = games.sort((a, b) => b.createdAt - a.createdAt)[0]!.id;
    const { openReplay } = (await import("/src/replay/replay-files.ts")) as unknown as {
      openReplay: (
        source: unknown,
      ) => Promise<{ exportFile: () => Promise<{ bytes: Uint8Array }>; dispose: () => void }>;
    };
    const host = await openReplay({ kind: "stored", gameId });
    const { bytes } = await host.exportFile();
    host.dispose();
    let text = "";
    for (const byte of bytes) text += String.fromCharCode(byte);
    return btoa(text);
  });
  return Buffer.from(base64, "base64");
}

test("a replay link shows the versus screen, then the board", async ({ page }) => {
  const replay = await twoHeroReplay(page);
  await page.route(`${SYNC}/replay/**`, (route) =>
    route.fulfill({ status: 200, headers: { ...CORS, "Content-Type": "text/plain" }, body: replay }),
  );
  // A new query, so the page loads again rather than only changing its hash.
  await page.goto(`/?again=1#replay=${ID}`);
  await waitForScene(page, "ReplayVersus", 30000);
  expect(await activeScenes(page)).not.toContain("Title");
  await waitForText(page, "SHE-HULK", { sceneKey: "ReplayVersus" });
  // A press ends the hold early; the board still comes up.
  await page.keyboard.press("Space");
  await waitForScene(page, "Board", 30000);
  await waitForScene(page, "ReplayTransportOverlay", 30000);
});
