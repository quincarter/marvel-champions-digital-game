import { expect, test, type Page } from "@playwright/test";
import { pressKey, trackPageErrors, waitFor } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Settings draws its body as a Lit panel over the canvas (`@mc/ui`'s `mc-settings-body`): the keyboard walks its rows
 * and switches one with Enter, a tap on a switch flips it, and on a phone a swipe that lifts over a switch only
 * scrolls the list (CLAUDE.md, no tap on finger lift).
 */

type States = Record<string, () => { focus: string | null; ringShown: boolean }>;

const body = (page: Page) => page.locator('#mc-ui [data-scene="SettingsOverlay"] mc-settings-body');

/** The label on a row's switch ("ON" / "OFF"), read from the panel. */
async function switchLabel(page: Page, id: string): Promise<string | null> {
  return body(page).evaluate(
    (element, key) =>
      (element as unknown as { elementOf(k: string): (HTMLElement & { label?: string }) | null }).elementOf(key)
        ?.label ?? null,
    id,
  );
}

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

test("the Settings body is a Lit panel the keyboard walks and switches", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openApp(page, "screen=settings", { landing: "SettingsOverlay" });
  await expect(body(page)).toBeVisible();
  await waitFor(async () => ((await switchLabel(page, "confirm-end-turn")) ? true : null), "rows drawn", 10000);

  // Down from the tabs into the rows: the ring is drawn over the panel.
  let focus: string | null = null;
  for (let i = 0; i < 12 && !focus?.startsWith("row:"); i++) {
    await pressKey(page, "ArrowDown");
    focus = (
      await page.evaluate(() => (window as unknown as { __mcFocusState: States }).__mcFocusState.SettingsOverlay!())
    ).focus;
  }
  expect(focus).toMatch(/^row:/);
  await expect(page.locator("#mc-ui .mc-focus-ring")).toBeVisible();

  // Enter switches the focused row.
  const id = focus!.slice("row:".length);
  const before = await switchLabel(page, id);
  await pressKey(page, "Enter");
  await waitFor(async () => ((await switchLabel(page, id)) !== before ? true : null), "the row switched", 5000);
  expect(errors).toEqual([]);
});

test("a tap flips a switch; a swipe that lifts over one only scrolls", async ({ page }, info) => {
  const phone = info.project.name === "phone";
  await openApp(page, "screen=settings", { landing: "SettingsOverlay" });
  await expect(body(page)).toBeVisible();
  const toggle = body(page).locator('[data-key="confirm-end-turn"]');
  await expect(toggle).toBeVisible();
  const before = await switchLabel(page, "confirm-end-turn");

  // A swipe that starts on the switch, travels and lifts back over it: on a phone the list scrolls under the finger
  // (the switch rides along under it), with a mouse the pointer simply goes away and comes back. Neither is a tap.
  const box = (await toggle.boundingBox())!;
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const scrollTop = () =>
    body(page).evaluate((element) => (element as unknown as { scroller: HTMLElement }).scroller.scrollTop);
  const scrolledBefore = await scrollTop();
  if (phone) await drag(page, true, start, { x: start.x, y: start.y - 150 });
  else {
    await drag(page, false, start, { x: start.x, y: start.y + 80 });
    await drag(page, false, { x: start.x, y: start.y + 80 }, start);
  }
  await page.waitForTimeout(400);
  if (phone) expect(await scrollTop()).toBeGreaterThan(scrolledBefore);
  expect(await switchLabel(page, "confirm-end-turn")).toBe(before);

  // A tap flips it.
  const now = (await toggle.boundingBox())!;
  if (phone) await page.touchscreen.tap(now.x + now.width / 2, now.y + now.height / 2);
  else await page.mouse.click(now.x + now.width / 2, now.y + now.height / 2);
  await waitFor(
    async () => ((await switchLabel(page, "confirm-end-turn")) !== before ? true : null),
    "the tap flipped the switch",
    5000,
  );
});
