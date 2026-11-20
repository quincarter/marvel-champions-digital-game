import { expect } from "@playwright/test";
import { test } from "./live-room-helpers.js";
import { waitFor } from "./helpers.js";
import { installWave6Helpers, visibleTexts, waitForScene } from "./wave6-helpers-a.js";
import { quietGuide } from "./wave6-helpers-b.js";

/**
 * Epic Multiplayer screens (issue #882, docs/live-game-rooms.md section 10) over the dev fixtures
 * (`view/epic-room-fixture.ts`; `?screen=room-lobby&epic=organizer|player`, `?screen=board&fixture=epic`). Written for the
 * final PR of the stack, where the suite runs; not run in this one. A 2-table pod started through the real room server
 * (`live-room-helpers.ts`) needs two table hosts' dev jumps, which come with the netcode e2e; the connection side has its
 * own two-socket tests (`live/epic-room.test.ts`, `live/epic-pod.test.ts`).
 */

test("the organizer's lobby shows each table, its host and why Start is off", async ({ page }) => {
  await installWave6Helpers(page);
  await quietGuide(page);
  await page.goto("/?screen=room-lobby&epic=organizer");
  await waitForScene(page, "RoomLobby", 30000);
  const texts = async (): Promise<string[]> => (await visibleTexts(page)).map((t) => t.text);
  await waitFor(async () => ((await texts()).includes("North Table") ? true : null), "the first table", 20000);
  const seen = await texts();
  expect(seen).toContain("Host: Ava");
  expect(seen.some((t) => /2 seats are still open/.test(t))).toBe(true);
});

test("a table's board carries the pod strip with Loki, Worlds Collide, the tables and the clock", async ({ page }) => {
  await installWave6Helpers(page);
  await quietGuide(page);
  await page.goto("/?screen=board&fixture=epic&mangog=1");
  await waitForScene(page, "Board", 30000);
  await waitFor(
    async () => ((await visibleTexts(page)).some((t) => t.text.startsWith("Loki, God of Lies")) ? true : null),
    "the pod strip",
    20000,
  );
  const lines = (await visibleTexts(page)).map((t) => t.text);
  expect(lines.some((t) => /Worlds Collide 3\/6/.test(t))).toBe(true);
  expect(lines.some((t) => /South Table · R4 · villain phase/.test(t))).toBe(true);
  expect(lines.some((t) => /Your pod can reach: The Mangog/.test(t))).toBe(true);
});
