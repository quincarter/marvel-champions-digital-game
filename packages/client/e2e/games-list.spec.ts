import { expect, test, type Page } from "@playwright/test";
import { activeScenes, hasText, settle, trackPageErrors, waitFor } from "./helpers.js";
import { clickStop, routeStops, waitForScene } from "./wave6-helpers-a.js";
import { gameFacts, openApp, startGame } from "./wave6-helpers-b.js";

/**
 * Device sync (#276): several games can be in progress, and the Title lists them. Desktop and tablet draw the list in
 * the art panel; a phone has an "In-progress games (N)" row that opens it full screen. Tap a game to resume it; Remove
 * asks first and retires the game. On a phone, the end of a swipe that lifts over a row or over Remove presses nothing.
 */

const SHOTS = process.env.SHOT_DIR ?? "";

interface Saved {
  readonly id: string;
  readonly status: string;
  readonly scenarioId: string;
}

async function savedGames(page: Page): Promise<Saved[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("mc-saves", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const all = await new Promise<{ id: string; status: string; createdAt: number; config: { scenarioId: string } }[]>(
      (resolve) => {
        const request = db.transaction("games").objectStore("games").getAll();
        request.onsuccess = () => resolve(request.result);
      },
    );
    db.close();
    return all
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((game) => ({ id: game.id, status: game.status, scenarioId: game.config.scenarioId }));
  });
}

/** Marks games as last played on other platforms, and (optionally) a time, the way a synced game arrives. */
async function stampGames(page: Page, stamps: Record<string, { platform: string; updatedAt?: number }>): Promise<void> {
  await page.evaluate(async (wanted) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("mc-saves", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction("games", "readwrite");
    const store = tx.objectStore("games");
    const all = await new Promise<Record<string, unknown>[]>((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
    });
    for (const game of all) {
      const stamp = wanted[game.id as string];
      if (!stamp) continue;
      store.put({
        ...game,
        lastPlayedOn: { platform: stamp.platform },
        ...(stamp.updatedAt === undefined ? {} : { updatedAt: stamp.updatedAt }),
      });
    }
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, stamps);
}

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

const center = (r: { x: number; y: number; width: number; height: number }) => ({
  x: r.x + r.width / 2,
  y: r.y + r.height / 2,
});

async function toTitle(page: Page): Promise<void> {
  await page.goto("/?unlock=all");
  await waitFor(async () => ((await activeScenes(page)).includes("Title") ? true : null), "Title", 30000);
  await settle(page, { quietMs: 500, maxMs: 3000 });
}

/** The scene whose stops hold the list: the Title on a split screen, the overlay on a phone once it is open. */
const listScene = (phone: boolean): string => (phone ? "GamesListOverlay" : "Title");

async function stopRect(page: Page, scene: string, key: string) {
  return waitFor(
    async () => (await routeStops(page, scene))?.stops.find((s) => s.key === key)?.rect ?? null,
    `${key} on ${scene}`,
  );
}

/** Opens the list (on a phone: the menu row, then the overlay). */
async function openList(page: Page, phone: boolean): Promise<void> {
  if (!phone) return;
  const row = center(await stopRect(page, "Title", "games-row"));
  await page.touchscreen.tap(row.x, row.y);
  await waitForScene(page, "GamesListOverlay");
  await settle(page, { quietMs: 400, maxMs: 2000 });
}

async function press(page: Page, phone: boolean, scene: string, key: string): Promise<void> {
  if (!phone) return clickStop(page, key, scene);
  const at = center(await stopRect(page, scene, key));
  await page.touchscreen.tap(at.x, at.y);
}

/** A point on a game row's text, above its buttons: a row tap there resumes the game. */
async function rowTextPoint(page: Page, scene: string, id: string) {
  const resume = await stopRect(page, scene, `game:${id}`);
  return { x: resume.x + 60, y: resume.y - 30 };
}

async function onBoard(page: Page): Promise<void> {
  await waitFor(
    async () => {
      const up = await activeScenes(page);
      return up.includes("Board") || up.includes("SetupDeal") ? true : null;
    },
    "a game opens",
    30000,
  );
}

async function twoGames(page: Page): Promise<[Saved, Saved]> {
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 43523 });
  await settle(page);
  await page.goto("/?unlock=all");
  await waitFor(async () => ((await activeScenes(page)).includes("Title") ? true : null), "Title", 30000);
  await startGame(page, {
    scenarioId: "klaw",
    decks: ["core-she-hulk-aggression", "core-black-panther-protection"],
    seed: 77,
  });
  await settle(page);
  const saved = await savedGames(page);
  expect(saved.map((game) => game.status)).toEqual(["active", "active"]);
  return [saved[0]!, saved[1]!];
}

test("two games in progress are both listed; each resumes on its own board; Remove asks first", async ({
  page,
}, info) => {
  test.setTimeout(300_000);
  const phone = info.project.name === "phone";
  await page.setViewportSize(phone ? { width: 375, height: 812 } : { width: 1280, height: 800 });
  const errors = trackPageErrors(page);
  const [rhino, klaw] = await twoGames(page);
  const now = Date.now();
  await stampGames(page, {
    [rhino.id]: { platform: "android", updatedAt: now - 26 * 3600_000 },
    [klaw.id]: { platform: "windows", updatedAt: now - 2 * 3600_000 },
  });

  await toTitle(page);
  const scene = listScene(phone);
  if (phone) {
    expect(await hasText(page, "In-progress games (2)", "Title")).toBe(true);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/games-list-phone-375x812-menu.png` });
  }
  await openList(page, phone);
  // Newest first: Klaw (2 h ago) above Rhino (yesterday).
  const stops = (await routeStops(page, scene))!.stops.map((s) => s.key);
  expect(stops).toContain(`game:${klaw.id}`);
  expect(stops).toContain(`game:${rhino.id}`);
  expect(stops.indexOf(`game:${klaw.id}`)).toBeLessThan(stops.indexOf(`game:${rhino.id}`));
  expect(stops).toContain(`game-remove:${rhino.id}`);
  expect(await hasText(page, "Resume", scene)).toBe(true);
  expect(await hasText(page, "2 h ago", scene)).toBe(true);
  expect(await hasText(page, "yesterday", scene)).toBe(true);
  if (!phone) expect(stops).toContain("continue");
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/games-list-${phone ? "phone-375x812-overlay" : "desktop-1280x800"}.png` });
  }

  // Each game opens on its own board: one seat (Rhino) or two (Klaw).
  // Press Resume on the Rhino row.
  await press(page, phone, scene, `game:${rhino.id}`);
  await onBoard(page);
  await waitFor(
    async () => ((await gameFacts<number>(page, "(s) => s.game?.players.length ?? 0")) ? true : null),
    "game",
  );
  expect(await gameFacts<number>(page, "(s) => s.game.players.length")).toBe(1);

  // The rest of the row (its text) resumes too.
  await toTitle(page);
  await openList(page, phone);
  const rowTap = await rowTextPoint(page, scene, klaw.id);
  if (phone) await page.touchscreen.tap(rowTap.x, rowTap.y);
  else await page.mouse.click(rowTap.x, rowTap.y);
  await onBoard(page);
  await waitFor(
    async () => ((await gameFacts<number>(page, "(s) => s.game?.players.length ?? 0")) ? true : null),
    "game",
  );
  expect(await gameFacts<number>(page, "(s) => s.game.players.length")).toBe(2);

  // Remove asks first: "Keep it" leaves both; "Remove" retires the one.
  await toTitle(page);
  await openList(page, phone);
  await press(page, phone, scene, `game-remove:${rhino.id}`);
  await waitFor(async () => ((await hasText(page, "Remove this game?", scene)) ? true : null), "the question");
  expect(await hasText(page, "counts as played", scene)).toBe(true);
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/games-list-${phone ? "phone-375x812" : "desktop-1280x800"}-remove.png` });
  }
  expect(
    (await savedGames(page)).map((game) => game.status),
    "asking removes nothing",
  ).toEqual(["active", "active"]);
  await press(page, phone, scene, "remove-keep");
  await waitFor(async () => ((await hasText(page, "Remove this game?", scene)) ? null : true), "the question closes");
  expect((await savedGames(page)).map((game) => game.status)).toEqual(["active", "active"]);

  await press(page, phone, scene, `game-remove:${rhino.id}`);
  await waitFor(async () => ((await hasText(page, "Remove this game?", scene)) ? true : null), "the question");
  await press(page, phone, scene, "remove-confirm");
  await waitFor(
    async () => ((await savedGames(page)).find((game) => game.id === rhino.id)?.status === "abandoned" ? true : null),
    "the game is retired",
  );
  expect((await savedGames(page)).find((game) => game.id === klaw.id)?.status).toBe("active");
  await settle(page, { quietMs: 500, maxMs: 3000 });
  const after = (await routeStops(page, scene))!.stops.map((s) => s.key);
  expect(after).not.toContain(`game:${rhino.id}`);
  // On a phone the overlay stays up with the one game left; on a split screen one game is just Continue.
  if (phone) expect(after).toContain(`game:${klaw.id}`);
  else expect(after).toContain("continue");
  expect(errors).toEqual([]);
});

test("a swipe lifting over a game row, Resume or Remove presses nothing; a tap does", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "the touch release is the phone's case");
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 375, height: 812 });
  const errors = trackPageErrors(page);
  const [rhino, klaw] = await twoGames(page);
  await stampGames(page, { [rhino.id]: { platform: "ios" }, [klaw.id]: { platform: "linux" } });
  await toTitle(page);
  await openList(page, true);

  const resume = await stopRect(page, "GamesListOverlay", `game:${klaw.id}`);
  const remove = await stopRect(page, "GamesListOverlay", `game-remove:${klaw.id}`);
  const text = await rowTextPoint(page, "GamesListOverlay", klaw.id);
  expect(resume.height, "Resume is primary height").toBeGreaterThanOrEqual(52);
  expect(remove.height, "Remove is touch height").toBeGreaterThanOrEqual(44);
  expect(remove.x - (resume.x + resume.width), "a 12 px gap between them").toBeGreaterThanOrEqual(12);
  const quiet = async (what: string): Promise<void> => {
    await settle(page, { quietMs: 500, maxMs: 2500 });
    expect(await activeScenes(page), `${what} resumed nothing`).toContain("GamesListOverlay");
    expect(await activeScenes(page)).not.toContain("Board");
    expect(await hasText(page, "Remove this game?", "GamesListOverlay"), `${what} asked nothing`).toBe(false);
  };

  // Up from below the list, lifting on the row's text, on Resume and on Remove.
  await touchSwipe(page, { x: text.x, y: text.y + 200 }, text);
  await quiet("a swipe lifting on a row");
  await touchSwipe(page, { x: resume.x + 60, y: resume.y + resume.height + 200 }, center(resume));
  await quiet("a swipe lifting on Resume");
  await touchSwipe(page, { x: remove.x + 40, y: remove.y + remove.height + 200 }, center(remove));
  await quiet("a swipe lifting on Remove");
  // Dragging the list itself (a press that began on a row) and lifting on Remove.
  await touchSwipe(page, { x: text.x, y: text.y - 10 }, center(remove));
  await quiet("a drag of the list lifting on Remove");
  await touchSwipe(page, { x: text.x, y: text.y - 10 }, center(resume));
  await quiet("a drag of the list lifting on Resume");
  expect((await savedGames(page)).map((game) => game.status)).toEqual(["active", "active"]);

  // A real tap on Remove asks.
  await page.touchscreen.tap(center(remove).x, center(remove).y);
  await waitFor(
    async () => ((await hasText(page, "Remove this game?", "GamesListOverlay")) ? true : null),
    "the question",
  );
  // And a tap on Keep it closes the question without removing.
  const keep = center(await stopRect(page, "GamesListOverlay", "remove-keep"));
  await page.touchscreen.tap(keep.x, keep.y);
  await waitFor(
    async () => ((await hasText(page, "Remove this game?", "GamesListOverlay")) ? null : true),
    "the question closes",
  );
  // A tap on the row's text resumes it.
  const again = await rowTextPoint(page, "GamesListOverlay", klaw.id);
  await page.touchscreen.tap(again.x, again.y);
  await onBoard(page);
  await toTitle(page);
  await openList(page, true);
  // And a tap on Resume itself.
  const go = center(await stopRect(page, "GamesListOverlay", `game:${klaw.id}`));
  await page.touchscreen.tap(go.x, go.y);
  await onBoard(page);
  expect(errors).toEqual([]);
});

test("on a touch tablet, a swipe lifting over the Title panel's Remove, Resume or a row presses nothing; a tap asks", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "phone", "the touch release is the touch project's case");
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 768, height: 1024 });
  const errors = trackPageErrors(page);
  const [rhino, klaw] = await twoGames(page);
  await stampGames(page, { [rhino.id]: { platform: "ios" }, [klaw.id]: { platform: "android" } });
  await toTitle(page);

  // A tablet is a split screen: the list is the panel in the art panel, no menu row.
  const resume = await stopRect(page, "Title", `game:${klaw.id}`);
  const remove = await stopRect(page, "Title", `game-remove:${klaw.id}`);
  const text = await rowTextPoint(page, "Title", klaw.id);
  const quiet = async (what: string): Promise<void> => {
    await settle(page, { quietMs: 500, maxMs: 2500 });
    expect(await activeScenes(page), `${what} resumed nothing`).toContain("Title");
    expect(await activeScenes(page)).not.toContain("Board");
    expect(await hasText(page, "Remove this game?", "Title"), `${what} asked nothing`).toBe(false);
  };
  await touchSwipe(page, { x: remove.x + 40, y: remove.y + remove.height + 160 }, center(remove));
  await quiet("a swipe lifting on Remove");
  await touchSwipe(page, { x: resume.x + 60, y: resume.y + resume.height + 160 }, center(resume));
  await quiet("a swipe lifting on Resume");
  await touchSwipe(page, { x: text.x, y: text.y + 160 }, text);
  await quiet("a swipe lifting on a row");
  await touchSwipe(page, { x: text.x, y: text.y - 10 }, center(remove));
  await quiet("a drag of the list lifting on Remove");
  expect((await savedGames(page)).map((game) => game.status)).toEqual(["active", "active"]);

  await page.touchscreen.tap(center(remove).x, center(remove).y);
  await waitFor(async () => ((await hasText(page, "Remove this game?", "Title")) ? true : null), "the question");
  expect(errors).toEqual([]);
});
