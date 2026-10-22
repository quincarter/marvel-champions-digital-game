import type { Page } from "@playwright/test";
import { clickText, hasText, pressAt, isSceneUp, settle, waitFor } from "./helpers.js";
import { clickStop, routeStops, waitForScene } from "./wave6-helpers-a.js";

/** Shared driving code for the save-transfer specs (`save-transfer.spec.ts`, `save-transfer-touch.spec.ts`). */

export const SAVE_DATA = "SaveDataOverlay";
/** The dev server's sync URL: `VITE_SYNC_URL` is unset in e2e, so `transfer-config.ts` falls back to this. */
export const SYNC = "http://localhost:8787";
export const ROOM = "ABCDEFGH";
export const KEY_PART = "JKMN";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export interface SyncRequest {
  readonly method: string;
  readonly path: string;
}

export interface FakeSync {
  /** Non-preflight requests the page made to the service, in order. */
  readonly requests: SyncRequest[];
}

/**
 * Stands in for the sync Worker. POST /transfer answers 201 with `ROOM`; GET /transfer/<room> answers `download`
 * (sealed bytes) or 404; `"abort"` drops the connection, which the client reads as the service being unavailable.
 */
export async function fakeSync(page: Page, options: { download?: Buffer | "abort" } = {}): Promise<FakeSync> {
  const requests: SyncRequest[] = [];
  await page.route(`${SYNC}/**`, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    requests.push({ method: request.method(), path: new URL(request.url()).pathname });
    if (options.download === "abort") return route.abort("connectionrefused");
    if (request.method() === "POST") {
      return route.fulfill({
        status: 201,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({ code: ROOM, expiresAt: Date.now() + 15 * 60_000 }),
      });
    }
    if (options.download) {
      return route.fulfill({
        status: 200,
        headers: { ...CORS, "Content-Type": "application/octet-stream" },
        body: options.download,
      });
    }
    return route.fulfill({
      status: 404,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "not-found", error: "not found" }),
    });
  });
  return { requests };
}

/** A sample save file sealed under `KEY_PART` by the page's own client code, as the Worker would hand it back. */
export async function sealedSample(page: Page): Promise<Buffer> {
  const bytes = await page.evaluate(async (keyPart) => {
    const crypto = (await import("/src/save-data/transfer-crypto.ts")) as unknown as {
      sealSaveFile: (file: unknown, keyPart: string) => Promise<Uint8Array>;
    };
    const fixtures = (await import("/src/save-data/transfer-fixtures.ts")) as unknown as {
      sampleSaveFile: (games?: number) => unknown;
    };
    return Array.from(await crypto.sealSaveFile(fixtures.sampleSaveFile(3), keyPart));
  }, KEY_PART);
  return Buffer.from(bytes);
}

/** Title ▸ Settings ▸ More ▸ Save data, then waits for the overlay's four action rows. */
export async function openSaveData(page: Page): Promise<void> {
  await waitForScene(page, "Title", 30000);
  await settle(page);
  await clickText(page, "SETTINGS", { sceneKey: "Title", until: () => isSceneUp(page, "SettingsOverlay") });
  await settle(page);
  await clickStop(page, "tab:more", "SettingsOverlay");
  await settle(page);
  // The row's stop spans the row; the Open button is at its right end.
  const row = await waitForSettingsRow(page);
  const at = { x: row.x + row.width - 40, y: row.y + row.height / 2 };
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await page.touchscreen.tap(at.x, at.y);
  else await pressAt(page, at.x, at.y);
  await waitForScene(page, SAVE_DATA);
  await waitForStop(page, "row:send");
}

export async function waitForStop(
  page: Page,
  key: string,
): Promise<{ x: number; y: number; width: number; height: number }> {
  return waitFor(
    async () => (await routeStops(page, SAVE_DATA))?.stops.find((s) => s.key === key)?.rect ?? null,
    `Save data control ${key}`,
    10000,
  );
}

export async function waitForSaveText(page: Page, substr: string): Promise<void> {
  await waitFor(
    async () => ((await hasText(page, substr, SAVE_DATA)) ? true : null),
    `Save data text "${substr}"`,
    10000,
  );
}

const waitForSettingsRow = (page: Page) =>
  waitFor(
    async () => (await routeStops(page, "SettingsOverlay"))?.stops.find((s) => s.key === "row:save-data")?.rect ?? null,
    "the Save data row",
    10000,
  );
