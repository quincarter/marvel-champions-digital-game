import { expect, test, type Page } from "@playwright/test";
import { pressAt, settle, waitFor } from "./helpers.js";
import { clickStop, installWave6Helpers, openSaga, trackErrors, waitForScene } from "./wave6-helpers-a.js";
import { hook, quietGuide, type Rect } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Issue #257: on a phone, dragging through the campaign roster's deck picker and lifting the finger closed the picker,
 * because its backdrop closed on any release over it. Now a drag that starts in the picker leaves it open wherever it
 * lifts, and only a tap on the backdrop closes it.
 */

const pickerOpen = async (page: Page): Promise<boolean> =>
  (await hook<boolean>(page, "__mcRosterPickerDebug", "open")) ?? false;

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

test("issue #257: a drag through the roster's deck picker leaves it open; a tap on the backdrop closes it", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await quietGuide(page);
  await page.goto("/?unlock=all");
  await openSaga(page);
  await clickStop(page, "vol-1", "CampaignSaga");
  await settle(page);
  await clickStop(page, "cta", "CampaignSaga");
  await waitForScene(page, "CampaignCover");
  await settle(page);
  await clickStop(page, "cta", "CampaignCover");
  await waitForScene(page, "CampaignRoster");
  await settle(page);
  await clickStop(page, "seat-1", "CampaignRoster");
  await settle(page);
  await waitFor(async () => ((await pickerOpen(page)) ? true : null), "the deck picker opens", 15_000);
  const panel = (await hook<Rect>(page, "__mcRosterPickerDebug", "panel"))!;
  const x = panel.x + panel.width / 2;

  // Up through the list, lifted inside the picker.
  await drag(page, phone, { x, y: panel.y + panel.height * 0.75 }, { x, y: panel.y + panel.height * 0.4 });
  await settle(page);
  expect(await pickerOpen(page), "a drag lifted inside the picker leaves it open").toBe(true);

  // Down through the list and past the panel's foot, lifted on the backdrop.
  await drag(page, phone, { x, y: panel.y + panel.height * 0.4 }, { x, y: panel.y + panel.height + 12 });
  await settle(page);
  expect(await pickerOpen(page), "a drag lifted on the backdrop leaves it open").toBe(true);
  if (SHOT) await page.screenshot({ path: `${SHOT}/roster-picker-drag-${info.project.name}.png` });

  // A tap on the backdrop closes it.
  const below = { x, y: panel.y + panel.height + 8 };
  if (phone) await page.touchscreen.tap(below.x, below.y);
  else await pressAt(page, below.x, below.y);
  await waitFor(
    async () => ((await pickerOpen(page)) ? null : true),
    "a tap on the backdrop closes the picker",
    15_000,
  );
  expect(errors).toEqual([]);
});
