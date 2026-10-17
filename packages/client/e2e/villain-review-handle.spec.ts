import { expect, test, type Page } from "@playwright/test";
import { activeScenes, pressAt, settle, waitFor, zoneRect } from "./helpers.js";
import { continueRect, reachVillainRecap } from "./overlay-helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { declineMulligans, hook, openApp, startGame, type Rect } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Issue #227: on a phone, a sideways swipe of the play area that lifted on the "ROUND N VILLAIN PHASE" handle at the
 * table's right edge opened the villain recap, because the handle opened on any release over it. The handle also sat
 * over the right end of the play area, hiding part of a card. Now only a tap on the handle opens the recap, and on the
 * phone the play area stops short of it.
 */

const handleRect = (page: Page): Promise<Rect | null> =>
  page.evaluate(
    () =>
      (window as unknown as { __mcBoardDebug?: { focusRect(key: string): Rect | null } }).__mcBoardDebug?.focusRect(
        "villain-review",
      ) ?? null,
  );

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

test("issue #227: a swipe that lifts on the villain review handle leaves the recap shut; a tap opens it", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 3 });
  await declineMulligans(page);
  await settle(page);

  // Through the first villain phase, then close its recap into the next player phase: the handle shows.
  await reachVillainRecap(page, phone);
  const close = (await continueRect(page))!;
  if (phone) await page.touchscreen.tap(close.x + close.width / 2, close.y + close.height / 2);
  else await pressAt(page, close.x + close.width / 2, close.y + close.height / 2);
  const handle = await waitFor(
    async () => ((await activeScenes(page)).includes("VillainPhaseOverlay") ? null : await handleRect(page)),
    "the villain review handle on the table",
    30_000,
  );
  // A crowded play area, as in the report: the row scrolls sideways.
  await hook(page, "__mcBoardDebug", "setBoardPad", { playArea: 8 });
  await settle(page);
  const play = (await zoneRect(page, "playArea"))!;
  if (phone) {
    expect(play.x + play.width, "the play area stops short of the handle").toBeLessThanOrEqual(handle.x);
    const cards = ((await hook<[string, Rect][]>(page, "__mcBoardDebug", "allFocusRects")) ?? []).filter(([key]) =>
      key.startsWith("card:padp-"),
    );
    expect(cards.length).toBeGreaterThan(0);
    for (const [key, rect] of cards)
      expect(rect.x + rect.width, `${key} is clear of the handle`).toBeLessThanOrEqual(handle.x);
  }
  if (SHOT) {
    // Past the player phase banner, so the shot shows the row beside the handle.
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SHOT}/villain-review-handle-${info.project.name}.png` });
  }

  // A sideways swipe that starts in the play area and lifts on the handle.
  const y = handle.y + handle.height / 2;
  await drag(page, phone, { x: play.x + 20, y }, { x: handle.x + handle.width / 2, y });
  await settle(page);
  expect(await activeScenes(page), "a swipe that lifted on the handle opens nothing").not.toContain(
    "VillainPhaseOverlay",
  );

  // A tap on the handle opens the recap for review.
  if (phone) await page.touchscreen.tap(handle.x + handle.width / 2, y);
  else await pressAt(page, handle.x + handle.width / 2, y);
  await waitFor(
    async () => ((await activeScenes(page)).includes("VillainPhaseOverlay") ? true : null),
    "the recap opens on a tap of the handle",
    15_000,
  );
  expect(errors).toEqual([]);
});
