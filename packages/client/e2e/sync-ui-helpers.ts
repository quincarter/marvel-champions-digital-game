import type { BrowserContext, Page, Route } from "@playwright/test";
import { activeScenes, clickText, hasText, isSceneUp, pressAt, settle, waitFor } from "./helpers.js";
import { clickStop, routeStops, waitForScene } from "./wave6-helpers-a.js";

/** Shared driving code for the device-sync UI specs (`sync-ui.spec.ts`, `sync-ui-touch.spec.ts`). */

export const SYNC = "http://localhost:8787";
export const SYNC_DATA = "SyncDataOverlay";
export const SAVE_DATA = "SaveDataOverlay";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

interface Space {
  token: string;
  cursor: number;
  readonly epoch: number;
  readonly records: Map<string, { version: number; deleted: boolean; data?: string }>;
}

export interface FakeSyncServer {
  readonly spaces: Map<string, Space>;
  /** Requests made, "METHOD /path". */
  readonly requests: string[];
  /** Answer every sync route with a dropped connection (the service being unreachable). */
  down: boolean;
  /** Answer the status route (and every sync route) 503 `disabled`, the Worker's kill switch. */
  disabled: boolean;
  /** Each sync route answers after this many milliseconds (a slow network). */
  latencyMs: number;
  /** Serves a page or every page of a context. */
  install(target: Page | BrowserContext): Promise<void>;
}

const json = (route: Route, status: number, body: unknown, extra: Record<string, string> = {}) =>
  route.fulfill({
    status,
    headers: { ...CORS, "Content-Type": "application/json", ...extra },
    body: JSON.stringify(body),
  });

const notFound = (route: Route) => json(route, 404, { reason: "not-found", error: "not found" });

/**
 * An in-memory stand-in for the sync Worker: the device-sync routes (`@mc/sync-worker/sync-protocol`) with one space per
 * id, a bearer token per space, a version counter and base-version conflicts, plus the transfer route that a device
 * link's QR code uploads to. Two browser contexts installing the same server see one cloud.
 */
export function fakeSyncServer(): FakeSyncServer {
  const spaces = new Map<string, Space>();
  const requests: string[] = [];
  const server: FakeSyncServer = {
    spaces,
    requests,
    down: false,
    disabled: false,
    latencyMs: 0,
    async install(target) {
      await target.route(`${SYNC}/**`, async (route) => {
        const request = route.request();
        if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
        const url = new URL(request.url());
        requests.push(`${request.method()} ${url.pathname}`);
        if (server.down) return route.abort("connectionrefused");
        if (server.latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, server.latencyMs));
        if (url.pathname === "/sync/status" && request.method() === "GET") {
          return server.disabled
            ? json(route, 503, { reason: "disabled", error: "Device sync is turned off right now." })
            : json(route, 200, { sync: true });
        }
        if (server.disabled && url.pathname.startsWith("/sync/"))
          return json(route, 503, { reason: "disabled", error: "Device sync is turned off right now." });
        if (url.pathname === "/transfer" && request.method() === "POST") {
          return json(route, 201, { code: "ABCDEFGH", expiresAt: Date.now() + 15 * 60_000 });
        }
        const match = /^\/sync\/([0-9a-f]{32})(\/changes|\/batch)?$/.exec(url.pathname);
        if (!match) return notFound(route);
        const [, id, sub] = match;
        const token = /^Bearer (.+)$/.exec(request.headers().authorization ?? "")?.[1] ?? "";
        const info = (space: Space) => ({
          cursor: space.cursor,
          bytes: 0,
          maxBytes: 10_000_000,
          records: [...space.records.values()].filter((r) => !r.deleted).length,
          createdAt: space.epoch,
          epoch: space.epoch,
        });
        let space = spaces.get(id!);
        if (request.method() === "POST" && !sub) {
          if (!space) {
            space = { token, cursor: 0, epoch: 1_000 + spaces.size, records: new Map() };
            spaces.set(id!, space);
            return json(route, 201, info(space));
          }
          return space.token === token ? json(route, 200, info(space)) : notFound(route);
        }
        if (!space || space.token !== token) return notFound(route);
        if (request.method() === "DELETE") {
          spaces.delete(id!);
          return route.fulfill({ status: 204, headers: CORS });
        }
        if (!sub) return json(route, 200, info(space));
        if (sub === "/changes") {
          const since = Number(url.searchParams.get("since") ?? "0");
          const all = [...space.records.entries()]
            .filter(([, r]) => r.version > since)
            .sort((a, b) => a[1].version - b[1].version);
          const page = all.slice(0, 200);
          const more = all.length > page.length;
          return json(route, 200, {
            cursor: more ? page[page.length - 1]![1].version : space.cursor,
            epoch: space.epoch,
            more,
            records: page.map(([key, r]) => ({
              key,
              version: r.version,
              deleted: r.deleted,
              ...(r.deleted ? {} : { data: r.data }),
            })),
          });
        }
        const { ops } = request.postDataJSON() as {
          ops: { key: string; baseVersion: number; data?: string; deleted?: boolean }[];
        };
        const results = ops.map((op) => {
          const current = space!.records.get(op.key);
          if (op.baseVersion !== (current?.version ?? 0)) {
            return { key: op.key, ok: false, reason: "conflict", version: current?.version ?? 0 };
          }
          space!.cursor++;
          space!.records.set(op.key, {
            version: space!.cursor,
            deleted: op.deleted === true,
            ...(op.deleted ? {} : { data: op.data! }),
          });
          return { key: op.key, ok: true, version: space!.cursor };
        });
        return json(route, 200, { cursor: space.cursor, results });
      });
    },
  };
  return server;
}

/** Title ▸ Settings ▸ More ▸ Save data ▸ Sync, then waits for the sync screen. */
export async function openSyncScreen(page: Page): Promise<void> {
  await waitForScene(page, "Title", 30000);
  await settle(page);
  await clickText(page, "SETTINGS", { sceneKey: "Title", until: () => isSceneUp(page, "SettingsOverlay") });
  await settle(page);
  await clickStop(page, "tab:more", "SettingsOverlay");
  await settle(page);
  const row = await waitFor(
    async () => (await routeStops(page, "SettingsOverlay"))?.stops.find((s) => s.key === "row:save-data")?.rect ?? null,
    "the Save data row",
    10000,
  );
  const at = { x: row.x + row.width - 40, y: row.y + row.height / 2 };
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await page.touchscreen.tap(at.x, at.y);
  else await pressAt(page, at.x, at.y);
  await waitForScene(page, SAVE_DATA);
  await syncStop(page, SAVE_DATA, "row:sync");
  await clickStop(page, "row:sync", SAVE_DATA);
  await waitForScene(page, SYNC_DATA);
}

export const syncStop = (page: Page, scene: string, key: string) =>
  waitFor(
    async () => (await routeStops(page, scene))?.stops.find((s) => s.key === key)?.rect ?? null,
    `${scene} control ${key}`,
    10000,
  );

export const waitForSyncText = (page: Page, substr: string, scene = SYNC_DATA) =>
  waitFor(async () => ((await hasText(page, substr, scene)) ? true : null), `${scene} text "${substr}"`, 15000);

export async function storedSyncCode(page: Page): Promise<string | null> {
  return page.evaluate(() => localStorage.getItem("mcsync.code"));
}

/** Puts a deck record straight into this browser's deck database, as saving a deck would. */
export async function putDeck(page: Page, id: string, name: string): Promise<void> {
  await page.evaluate(
    async ({ id, name }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("mc-decks", 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains("decks"))
            request.result.createObjectStore("decks", { keyPath: "id" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tx = db.transaction("decks", "readwrite");
      tx.objectStore("decks").put({ id, name, updatedAt: Date.now() });
      await new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve();
      });
      db.close();
    },
    { id, name },
  );
}

export async function deckNames(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("mc-decks", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!db.objectStoreNames.contains("decks")) return [];
    const all = await new Promise<{ name: string }[]>((resolve) => {
      const request = db.transaction("decks").objectStore("decks").getAll();
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return all.map((deck) => deck.name);
  });
}

/** Appends one command to the stored game, as playing a turn on this device would. */
export async function appendCommand(page: Page, type: string, gameId?: string): Promise<void> {
  await page.evaluate(
    async ({ type, gameId }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("mc-saves", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tx = db.transaction(["games", "commands"], "readwrite");
      const games = tx.objectStore("games");
      const all = await new Promise<{ id: string; commandCount: number }[]>((resolve) => {
        const request = games.getAll();
        request.onsuccess = () => resolve(request.result);
      });
      const game = (gameId ? all.find((g) => g.id === gameId) : all[0])!;
      tx.objectStore("commands").put({ gameId: game.id, seq: game.commandCount, command: { type } });
      games.put({
        ...game,
        commandCount: game.commandCount + 1,
        round: (game as { round?: number }).round,
        updatedAt: Date.now(),
      });
      await new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve();
      });
      db.close();
    },
    { type, gameId },
  );
}

export async function gameIds(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("mc-saves", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const all = await new Promise<{ id: string }[]>((resolve) => {
      const request = db.transaction("games").objectStore("games").getAll();
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return all.map((g) => g.id);
  });
}

export async function gameCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("mc-saves", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const all = await new Promise<{ commandCount: number }[]>((resolve) => {
      const request = db.transaction("games").objectStore("games").getAll();
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return all.length;
  });
}

export const isUp = async (page: Page, scene: string) => (await activeScenes(page)).includes(scene);

/**
 * Types `text` into the join field: presses it, types, and checks the field really holds it (a press that lands while
 * the screen is still redrawing can miss the focus), trying again from an emptied field when it does not.
 */
export async function typeIntoJoinField(page: Page, text: string): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    await settle(page, { quietMs: 300, maxMs: 1500 });
    const rect = await syncStop(page, SYNC_DATA, "code");
    await pressAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.waitForTimeout(150);
    await page.keyboard.press("Control+A");
    await page.keyboard.type(text);
    const held = await page.evaluate(() => document.querySelector("input")?.value ?? "");
    if (held === text) return;
  }
  throw new Error("the join field never took the typed code");
}
