import type { BrowserContext, Page, Route } from "@playwright/test";
import { settle, waitFor } from "./helpers.js";
import { routeStops, waitForScene } from "./wave6-helpers-a.js";
import type { Rect } from "./wave6-helpers-b.js";

/** Shared driving code for the global win rates specs (`global-stats.spec.ts`) and their screenshots. */

export const WORKER = "http://localhost:8787";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export interface FakeWorker {
  /** "METHOD /path?query" for every request the page made to the Worker. */
  readonly requests: string[];
  /** The global routes answer 503 (the Worker down); the sync status probe still answers. */
  down: boolean;
  /** What /global/cards answers for a villain, by name; absent: 404 not-found. */
  cards: Record<string, unknown>;
  /** What /global/stats answers: `STATS_BODY` unless a spec sets another (e.g. too few games for any row). */
  stats: unknown;
}

export const STATS_BODY = {
  updatedAt: 1_700_000_000_000,
  games: 140,
  heroes: [
    { key: "01001a", games: 40, wins: 30, causes: { scheme: 6, villain: 4 } },
    { key: "01010a", games: 24, wins: 12, causes: { minions: 8, other: 4 } },
  ],
  villains: [
    { key: "Rhino", games: 60, wins: 42, causes: { scheme: 10, villain: 8 } },
    { key: "Klaw", games: 30, wins: 15, causes: { scheme: 15 } },
  ],
  modulars: [],
};

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify(body) });

/**
 * An in-memory stand-in for the Worker's routes this feature uses: the sync status probe (the ask is shown only while
 * the Worker is on offer), `/global/stats` and `/global/cards`. The sync question is marked answered so it never
 * competes with the one under test.
 */
export async function fakeWorker(target: Page | BrowserContext): Promise<FakeWorker> {
  const worker: FakeWorker = { requests: [], down: false, cards: {}, stats: STATS_BODY };
  await target.addInitScript(() => {
    try {
      if (localStorage.getItem("mcsync.prompted") === null) localStorage.setItem("mcsync.prompted", "1");
    } catch {}
  });
  await target.route(`${WORKER}/**`, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(request.url());
    worker.requests.push(`${request.method()} ${url.pathname}${url.search}`);
    if (url.pathname === "/sync/status") return json(route, 200, { sync: true });
    if (!url.pathname.startsWith("/global/")) return json(route, 404, { reason: "not-found", error: "not found" });
    if (worker.down) return json(route, 503, { reason: "disabled", error: "off" });
    if (url.pathname === "/global/stats") return json(route, 200, worker.stats);
    if (url.pathname === "/global/cards") {
      const villain = url.searchParams.get("villain") ?? "";
      const body = worker.cards[villain];
      return body ? json(route, 200, body) : json(route, 404, { reason: "not-found", error: "not found" });
    }
    return json(route, 404, { reason: "not-found", error: "not found" });
  });
  return worker;
}

export const globalRequests = (worker: FakeWorker): string[] => worker.requests.filter((r) => r.includes("/global/"));

/** Five finished games (three Spider-Man wins over Rhino, a loss to Rhino and a loss to Klaw), with their summaries. */
export async function seedFinishedGames(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { IdbGameStorage } = (await import("/src/engine/idb-game-storage.ts")) as never as {
      IdbGameStorage: new () => { create(meta: unknown, state: unknown): Promise<void> };
    };
    const { SAVE_SCHEMA } = (await import("/src/engine/game-storage.ts")) as never as { SAVE_SCHEMA: number };
    const store = new IdbGameStorage();
    for (let i = 0; i < 5; i++) {
      const won = i < 3;
      await store.create(
        {
          id: `e2e-global-${i}`,
          schema: SAVE_SCHEMA,
          config: {
            scenarioId: i === 4 ? "klaw" : "rhino",
            difficulty: "standard",
            players: [{ starterDeckId: "core-spider-man-justice" }],
            seed: i,
          },
          createdAt: i,
          updatedAt: 100 + i,
          status: won ? "won" : "lost",
          round: 5 + i,
          commandCount: 50,
          outcome: won
            ? { result: "win", reason: "villainDefeated" }
            : { result: "loss", reason: "mainSchemeCompleted" },
          campaignId: null,
          campaignNodeId: null,
          lastPlayedOn: { platform: "windows" },
          summary: {
            lossReason: won ? null : "schemeCompleted",
            heroesDefeated: 0,
            winners: [],
            alliesPlayed: 0,
            seats: [
              {
                identityCardId: "01001a",
                aspects: ["justice"],
                deck: ["01002", "01008", "01093"],
                plays: { "01008": 2 },
                activations: { "01008": 1 },
                entered: {},
                damage: 8,
                thwart: 4,
                defeated: false,
              },
            ],
            villains: [i === 4 ? "Klaw" : "Rhino"],
            version: 2,
            sideSchemes: { seen: {}, defeated: {} },
          },
        },
        {},
      );
    }
  });
}

export const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 0) < 768;

export async function stopRect(page: Page, scene: string, key: string): Promise<Rect> {
  return waitFor(
    async () => (await routeStops(page, scene))?.stops.find((s) => s.key === key)?.rect ?? null,
    `${scene} control ${key}`,
    15_000,
  );
}

/** Presses a stop with a finger on a phone, the mouse elsewhere, once the screen has stopped redrawing. */
export async function press(page: Page, scene: string, key: string, fromRight = 0): Promise<void> {
  await stopRect(page, scene, key);
  await settle(page, { quietMs: 250, maxMs: 1500 });
  const rect = await stopRect(page, scene, key);
  // `fromRight`: a wide row is pressed near its right edge, where its Open button is.
  const x = fromRight > 0 ? rect.x + rect.width - fromRight : rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  if (isPhone(page)) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

export async function hasStop(page: Page, scene: string, key: string): Promise<boolean> {
  return ((await routeStops(page, scene))?.stops ?? []).some((s) => s.key === key);
}

/** The keys of a scene's stops now, in route order. */
export async function stopKeys(page: Page, scene: string): Promise<string[]> {
  return ((await routeStops(page, scene))?.stops ?? []).map((s) => s.key);
}

/** A stats body with `games` shared and no row at 20 games yet. */
export const fewGames = (games: number) => ({
  updatedAt: 1_700_000_000_000,
  games,
  heroes: [],
  villains: [],
  modulars: [],
});

/** A finger that goes down on `from` and lifts over `to`, with a real touch sequence over CDP. */
export async function swipeOver(
  page: Page,
  from: { x: number; y: number; width: number; height: number },
  to: { x: number; y: number; width: number; height: number },
): Promise<void> {
  const a = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const b = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...a, id: 1 }] });
  for (let i = 1; i <= 10; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: a.x + ((b.x - a.x) * i) / 10, y: a.y + ((b.y - a.y) * i) / 10, id: 1 }],
    });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/** Title, Settings, More, Save data. */
export async function openSaveData(page: Page): Promise<void> {
  await waitForScene(page, "Title", 30_000);
  await settle(page);
  await press(page, "Title", "settings");
  await waitForScene(page, "SettingsOverlay");
  await settle(page);
  await press(page, "SettingsOverlay", "tab:more");
  await settle(page);
  await press(page, "SettingsOverlay", "row:save-data", 40);
  await waitForScene(page, "SaveDataOverlay");
  await settle(page);
}

export const stored = (page: Page, key: string): Promise<string | null> =>
  page.evaluate((k) => localStorage.getItem(k), key);
