import { expect, type Page } from "@playwright/test";
import { activeScenes, pressAt, settle, waitFor } from "./helpers.js";
import {
  clickStop,
  installWave6Helpers,
  routeStops,
  trackErrors,
  visibleTexts,
  waitForScene,
} from "./wave6-helpers-a.js";
import { declineMulligans, quietGuide } from "./wave6-helpers-b.js";
import { copiedText, stubClipboard, test } from "./live-room-helpers.js";

/**
 * Hosting a live game (issue #876): a game set up as watchable opens a room on its first command and streams to it;
 * the top bar's eye shows the watchers and copies the watch link; Pause offers the link. A game that is not watchable
 * opens no room. The room is a real one (`live-room-helpers.ts`: the Worker's room logic behind a local server).
 */

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function openBoard(page: Page, query: string): Promise<void> {
  await installWave6Helpers(page);
  await quietGuide(page);
  await stubClipboard(page);
  await page.goto(`/?screen=board&${query}`);
  await waitForScene(page, "Board", 30000);
}

/** The eye's hit rect on the top bar, or null while it is not drawn. */
const eyeRect = (page: Page): Promise<Box | null> =>
  page.evaluate(() => {
    const debug = (window as unknown as { __mcBoardDebug?: { allFocusRects: () => [string, Box][] } }).__mcBoardDebug;
    return debug?.allFocusRects().find(([key]) => key.includes("watch"))?.[1] ?? null;
  });

async function pressEye(page: Page): Promise<void> {
  const rect = await waitFor(() => eyeRect(page), "the watch eye on the top bar", 15000);
  await pressAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
}

/** The number drawn inside the eye's rect, or null when there is none. */
async function eyeCount(page: Page): Promise<string | null> {
  const rect = await eyeRect(page);
  if (!rect) return null;
  const inside = (await visibleTexts(page)).filter(
    (t) =>
      t.scene === "Board" &&
      /^\d+$/.test(t.text) &&
      t.x >= rect.x &&
      t.x <= rect.x + rect.width &&
      t.y >= rect.y &&
      t.y <= rect.y + rect.height,
  );
  return inside[0]?.text ?? null;
}

const sawText = async (page: Page, pattern: RegExp): Promise<true | null> =>
  (await visibleTexts(page)).some((t) => pattern.test(t.text)) ? true : null;

test("a watchable game opens a room on its first command, streams to it, and shows who is watching", async ({
  page,
  room,
}) => {
  test.setTimeout(150_000);
  const errors = trackErrors(page);
  await openBoard(page, "scenario=rhino&deck=drs-protection&seed=3&watch=1");

  // Nothing is created before the player does something: the mulligan sheet is still open.
  await settle(page);
  expect(room.creates()).toBe(0);
  expect(await eyeRect(page)).toBeNull();

  await declineMulligans(page);
  await waitFor(async () => (room.creates() > 0 ? true : null), "POST /room after the first command", 30000);
  await waitFor(async () => (room.room()!.logLength() > 0 ? true : null), "the room holds commands", 30000);
  expect(room.creates()).toBe(1);
  expect(room.sockets()).toBe(1);

  // The host says hello with the token the room issued, then the header goes out as `start`, then the commands.
  const kinds = room.sent.map((m) => m.kind);
  expect(room.sent[0]).toMatchObject({ ch: "room", kind: "hello", host: true });
  expect(kinds.indexOf("start")).toBe(1);
  expect(kinds.indexOf("commands")).toBeGreaterThan(kinds.indexOf("start"));
  expect(room.sent.find((m) => m.kind === "start")).toMatchObject({
    ch: "game",
    table: "t1",
    header: { format: "mc-live" },
  });
  // Command batches continue the log without a gap, and the room took every one (it refuses a gap).
  let next = 0;
  for (const batch of room.sent.filter((m) => m.kind === "commands")) {
    expect(batch.from).toBe(next);
    next += (batch.commands as unknown[]).length;
  }
  expect(next).toBe(room.room()!.logLength());

  const roomId = room.room()!.id;
  const first = await room.joinWatcher(roomId);
  await room.joinWatcher(roomId);
  // A bar too narrow for the eye goes without it (a phone: the pause menu still has the link, checked below).
  const narrow = (page.viewportSize()?.width ?? 1440) < 600;
  if (narrow) {
    await settle(page);
    expect(await eyeRect(page), "a phone bar has no room for the eye").toBeNull();
  } else {
    // The eye is there until someone watches, and the number appears with the first watchers.
    await waitFor(async () => ((await eyeCount(page)) === "2" ? true : null), 'the eye shows "2"', 15000);
    first.leave();
    await waitFor(async () => ((await eyeCount(page)) === "1" ? true : null), 'the eye shows "1"', 15000);

    // Pressing the eye copies a link that ends in #watch=<roomId>, and a toast says so.
    await pressEye(page);
    await waitFor(async () => (await copiedText(page)) ?? null, "the watch link copied", 10000);
    expect(await copiedText(page)).toMatch(new RegExp(`#watch=${roomId}$`));
    await waitFor(() => sawText(page, /link copied/i), "the toast", 10000);
  }

  // Pause offers "Copy watch link" while the room is open (a phone has it among the quick buttons).
  const linkStop = narrow ? "quick:watch-link" : "watch-link";
  await page.keyboard.press("Escape");
  await waitForScene(page, "PauseOverlay");
  await settle(page);
  expect(((await routeStops(page, "PauseOverlay"))?.stops ?? []).map((s) => s.key)).toContain(linkStop);
  await clickStop(page, linkStop, "PauseOverlay");
  // The pause item says "Link copied" on a desktop; a phone's quick button is an icon, so read what it copied.
  await waitFor(async () => (await copiedText(page)) ?? null, "the link copied from Pause", 10000);
  if (!narrow) await waitFor(() => sawText(page, /link copied/i), "Link copied", 10000);
  // The link it copied is the room's.
  expect(await copiedText(page)).toMatch(new RegExp(`#watch=${roomId}$`));
  expect(await activeScenes(page)).toContain("PauseOverlay");
  expect(errors).toEqual([]);
});

test("a game that is not watchable opens no socket and shows no eye", async ({ page, room }) => {
  test.setTimeout(150_000);
  const errors = trackErrors(page);
  await openBoard(page, "scenario=rhino&deck=drs-protection&seed=3");
  await declineMulligans(page);
  await settle(page);
  // Give a stray room every chance to appear.
  await page.waitForTimeout(1500);
  expect(room.creates()).toBe(0);
  expect(room.sockets()).toBe(0);
  expect(await eyeRect(page)).toBeNull();
  await page.keyboard.press("Escape");
  await waitForScene(page, "PauseOverlay");
  await settle(page);
  const keys = ((await routeStops(page, "PauseOverlay"))?.stops ?? []).map((s) => s.key);
  expect(keys).not.toContain("watch-link");
  expect(keys).not.toContain("quick:watch-link");
  expect(errors).toEqual([]);
});
