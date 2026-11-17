import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, settle, waitFor } from "./helpers.js";
import { clickStop, routeStops, screens, trackErrors, waitForScene } from "./wave6-helpers-a.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";

/**
 * "No tap on finger lift" for Manual adjust (issue #791, CLAUDE.md standing rule): on a phone, a swipe of the target
 * list that lifts over a row, or over Done, must press neither. A tap on a row still opens its page.
 */

const SCENE = "ManualAdjustOverlay";

const stops = async (page: Page) => (await routeStops(page, SCENE))?.stops ?? [];

/** A finger (phone) or mouse (desktop) drag from `from` to `to`, lifted at `to`. */
async function drag(page: Page, phone: boolean, from: { x: number; y: number }, to: { x: number; y: number }) {
  const steps = 10;
  const at = (i: number) => ({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
  if (!phone) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) await page.mouse.move(at(i).x, at(i).y);
    await page.mouse.up();
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= steps; i++)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...at(i), id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

const centre = (r: { x: number; y: number; width: number; height: number }) => ({
  x: r.x + r.width / 2,
  y: r.y + r.height / 2,
});

test("issue #791: a swipe of the Manual adjust list that lifts on a row or on Done presses nothing", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=board&fixture=crowded");
  await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "the board", 90_000);
  await settle(page, { quietMs: 600, maxMs: 6000 });

  // Pause from the real MENU button (a press that lands mid-transition is pressed again), then Manual adjust.
  for (let attempt = 0; attempt < 10 && !(await screens(page)).includes("PauseOverlay"); attempt++) {
    await clickText(page, "MENU", { sceneKey: "Board" }).catch(() => undefined);
    await page.waitForTimeout(1200);
  }
  await waitForScene(page, "PauseOverlay");
  if (phone) await clickStop(page, "quick-toggle", "PauseOverlay");
  await clickStop(page, phone ? "quick:manualAdjust" : "manual-adjust", "PauseOverlay");
  await waitForScene(page, SCENE);
  await settle(page, { quietMs: 400, maxMs: 3000 });

  const rows = (await stops(page)).filter((s) => s.key.startsWith("target:"));
  const done = (await stops(page)).find((s) => s.key === "done")!;
  expect(rows.length, "the table has several things to correct").toBeGreaterThan(3);
  const onList = async (): Promise<boolean> => {
    const keys = (await stops(page)).map((s) => s.key);
    return keys.some((k) => k.startsWith("target:")) && !keys.some((k) => k.startsWith("choice:"));
  };

  // A swipe up the list that lifts over a different row than it began on.
  const first = centre(rows[rows.length - 1]!.rect);
  const second = centre(rows[Math.max(0, rows.length - 3)]!.rect);
  await drag(page, phone, first, { x: second.x, y: second.y - 10 });
  await settle(page, { quietMs: 300, maxMs: 2000 });
  expect(await screens(page), "the sheet is still up").toContain(SCENE);
  expect(await onList(), "a swipe that lifted on a row opened no target's page").toBe(true);

  // A swipe that starts in the list and lifts on Done.
  const start = centre((await stops(page)).filter((s) => s.key.startsWith("target:"))[1]!.rect);
  await drag(page, phone, start, centre(done.rect));
  await settle(page, { quietMs: 300, maxMs: 2000 });
  expect(await screens(page), "a swipe that lifted on Done did not close the sheet").toContain(SCENE);
  expect(await onList(), "still the list").toBe(true);

  // A tap on a row does open its page.
  const target = (await stops(page)).find((s) => s.key.startsWith("target:"))!;
  await clickStop(page, target.key, SCENE);
  await waitFor(
    async () => ((await stops(page)).some((s) => s.key.startsWith("choice:")) ? true : null),
    "a tap on a row opens its page",
    15_000,
  );
  expect(errors).toEqual([]);
});
