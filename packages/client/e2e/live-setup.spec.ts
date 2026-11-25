import { expect, type Page } from "@playwright/test";
import { pressAt, pressHookStop, settle, waitFor } from "./helpers.js";
import { boardRound, endTurnToNextRound, installWave6Helpers, trackErrors, waitForScene } from "./wave6-helpers-a.js";
import { dealToFirstTurn, quietGuide } from "./wave6-helpers-b.js";
import { stubClipboard, test, type RoomServer } from "./live-room-helpers.js";

/**
 * Table setup's "Let people watch this game" toggle (issue #876): it starts from the "Always allow watchers" setting,
 * a player can flip it either way, and the game that starts opens a room only when it was on. Read back through the
 * room, not the toggle's pixels: a game that streams creates a room on its first command.
 */

async function openSetup(page: Page, alwaysAllow: boolean): Promise<void> {
  await installWave6Helpers(page);
  await quietGuide(page);
  await stubClipboard(page);
  // The suite's own settings, plus the one under test (a spec that sets `mc-settings` replaces the suite's).
  await page.addInitScript((on) => {
    localStorage.setItem(
      "mc-settings",
      JSON.stringify({
        version: 1,
        villainAutoAdvance: "on",
        flipEncounterCards: false,
        holdEncounterCards: false,
        liveWatch: on,
      }),
    );
  }, alwaysAllow);
  await page.goto("/?screen=table-setup");
  await waitForScene(page, "Setup", 30000);
  await settle(page);
}

/** Scrolls the watch row into view (a phone's setup list is longer than the screen) and presses it. */
async function pressWatchToggle(page: Page): Promise<void> {
  const size = page.viewportSize() ?? { width: 1440, height: 900 };
  let row = await waitFor(() => watchStop(page), "the watch toggle", 15000);
  for (let step = 0; step < 40 && (row.y < 120 || row.y + row.height > size.height - 90); step++) {
    await page.mouse.move(size.width / 2, size.height / 2);
    await page.mouse.wheel(0, row.y < 120 ? -200 : 200);
    await settle(page);
    row = (await watchStop(page)) ?? row;
  }
  await settle(page, { quietMs: 150, maxMs: 500 });
  row = (await watchStop(page)) ?? row;
  await pressAt(page, row.x + row.width / 2, row.y + row.height / 2);
  await settle(page);
}

async function dealIt(page: Page): Promise<void> {
  await pressHookStop(page, "__mcTableSetupDebug", "deal-it-out");
  await dealToFirstTurn(page);
}

async function expectRoom(page: Page, room: RoomServer, opens: boolean): Promise<void> {
  if (opens) {
    // The room opens on the first command made once the live-room worker is up. The worker starts when the game
    // begins and, on a cold dev server, loads after the deal's own commands (Keep all, setup choices) have run, so
    // those are only held, not streamed. End turn is a command the worker is certain to see.
    if (room.creates() === 0) await endTurnToNextRound(page, (await boardRound(page)) ?? 1);
    await waitFor(async () => (room.creates() > 0 ? true : null), "a room after the first command", 30000);
    expect(room.creates()).toBe(1);
    await waitFor(async () => (room.sent.some((m) => m.kind === "start") ? true : null), "the game streamed", 30000);
  } else {
    await settle(page);
    await page.waitForTimeout(1500);
    expect(room.creates()).toBe(0);
    expect(room.sockets()).toBe(0);
  }
}

test("with Always allow watchers on, the toggle starts on and the game opens a room", async ({ page, room }) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await openSetup(page, true);
  await dealIt(page);
  await expectRoom(page, room, true);
  expect(errors).toEqual([]);
});

test("turning the toggle off in setup starts a game that opens no room, even with Always allow on", async ({
  page,
  room,
}) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await openSetup(page, true);
  await pressWatchToggle(page);
  await settle(page);
  await dealIt(page);
  await expectRoom(page, room, false);
  expect(errors).toEqual([]);
});

test("with Always allow off, the toggle starts off and the game opens no room", async ({ page, room }) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await openSetup(page, false);
  await dealIt(page);
  await expectRoom(page, room, false);
  expect(errors).toEqual([]);
});

test("with Always allow off, turning the toggle on in setup opens a room", async ({ page, room }) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await openSetup(page, false);
  await pressWatchToggle(page);
  await settle(page);
  await dealIt(page);
  await expectRoom(page, room, true);
  expect(errors).toEqual([]);
});

/** Whether "Let people watch this game" is on, from Table setup's debug hook. */
const watchOn = (page: Page): Promise<boolean | null> =>
  page.evaluate(
    () =>
      (
        window as unknown as { __mcTableSetupDebug?: { watchable?: () => boolean } }
      ).__mcTableSetupDebug?.watchable?.() ?? null,
  );

/** The watch row's rect, from Table setup's stops hook. */
const watchStop = (page: Page): Promise<{ x: number; y: number; width: number; height: number } | null> =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          __mcTableSetupDebug?: { stops: () => { key: string; x: number; y: number; width: number; height: number }[] };
        }
      ).__mcTableSetupDebug
        ?.stops()
        .find((s) => s.key === "watch") ?? null,
  );

test("a swipe of the setup list that lifts over the watch toggle leaves it alone; a tap flips it", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "phone", "touch only");
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await openSetup(page, false);
  const size = page.viewportSize() ?? { width: 390, height: 844 };
  // Wheel the setup list until the row is on screen with room above it for a swipe.
  let row = await waitFor(() => watchStop(page), "the watch toggle", 15000);
  for (let step = 0; step < 40 && (row.y < 220 || row.y + row.height > size.height - 90); step++) {
    await page.mouse.move(size.width / 2, size.height / 2);
    await page.mouse.wheel(0, row.y < 220 ? -200 : 200);
    await settle(page);
    row = (await watchStop(page)) ?? row;
  }
  expect(row.y, "the toggle is on screen").toBeGreaterThanOrEqual(150);
  const target = { x: row.x + row.width / 2, y: row.y + row.height / 2 };
  // The toggle's own state (pixels shift with the list's sub-pixel scroll, so they can't tell a flip apart).
  const before = await watchOn(page);
  expect(before, "the setup reports the toggle").not.toBeNull();

  const cdp = await page.context().newCDPSession(page);
  const from = { x: target.x, y: Math.max(80, target.y - 120) };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= 10; i++) {
    const y = from.y + ((target.y - from.y) * i) / 10;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: target.x, y, id: 1 }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await settle(page);
  // The list may have scrolled under the swipe: look at the toggle where it is now.
  const after = (await watchStop(page)) ?? row;
  expect(await watchOn(page), "the swipe's lift flipped the toggle").toBe(before);

  await page.touchscreen.tap(after.x + after.width / 2, after.y + after.height / 2);
  await settle(page);
  expect(await watchOn(page), "a tap flips the toggle").toBe(!before);
  expect(errors).toEqual([]);
});
