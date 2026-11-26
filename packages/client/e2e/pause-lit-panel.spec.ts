import { expect, test, type Page } from "@playwright/test";
import { pressKey, trackPageErrors, waitFor } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Pause draws its sheet as a Lit panel over the canvas (`@mc/ui`'s `mc-sheet`, built by `scenes/pause.ts` from the
 * rects `view/pause-layout.ts` gives): the keyboard walks its stops with the DOM focus ring and Enter presses Resume,
 * and on a phone a swipe that lifts over a switch only scrolls the Table group (CLAUDE.md, no tap on finger lift).
 */

type States = Record<string, () => { focus: string | null; ringShown: boolean }>;

const sheet = (page: Page) => page.locator('#mc-ui [data-scene="PauseOverlay"] mc-sheet');

const focusState = (page: Page) =>
  page.evaluate(() => (window as unknown as { __mcFocusState: States }).__mcFocusState.PauseOverlay!());

/** The label on a switch ("ON" / "OFF"), read from the panel. */
const switchLabel = (page: Page, key: string): Promise<string | null> =>
  sheet(page).evaluate(
    (element, k) =>
      (element as unknown as { elementOf(k: string): (HTMLElement & { label?: string }) | null }).elementOf(k)?.label ??
      null,
    key,
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

test("Pause is a Lit panel the keyboard walks, and Enter on Resume closes it", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openApp(page, "screen=pause", { landing: "PauseOverlay" });
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).locator('[data-key="resume"]')).toBeVisible();

  // Down through the stops until the ring is on Resume: it is drawn over the panel.
  let focus: string | null = null;
  for (let i = 0; i < 40 && focus !== "resume"; i++) {
    await pressKey(page, "ArrowDown");
    focus = (await focusState(page)).focus;
  }
  expect(focus).toBe("resume");
  await expect(page.locator("#mc-ui .mc-focus-ring")).toBeVisible();

  await pressKey(page, "Enter");
  await expect(sheet(page)).toHaveCount(0, { timeout: 10000 });
  expect(errors).toEqual([]);
});

test("on a phone, a swipe that lifts over a switch only scrolls the Table group", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "the Table group is the phone sheet's");
  await openApp(page, "screen=pause", { landing: "PauseOverlay" });
  await expect(sheet(page)).toBeVisible();
  const key = await sheet(page).evaluate((element) => {
    const found = (element as unknown as { renderRoot: ParentNode }).renderRoot.querySelector(
      '[data-key^="table:"][data-key$=":switch"]',
    );
    return found?.getAttribute("data-key") ?? null;
  });
  expect(key).not.toBeNull();
  const toggle = sheet(page).locator(`[data-key="${key}"]`);
  await expect(toggle).toBeVisible();
  const before = await switchLabel(page, key!);
  // Every switch's label, so a lift over any of them that fired would show.
  const allLabels = () =>
    sheet(page).evaluate((element) =>
      [
        ...(element as unknown as { renderRoot: ParentNode }).renderRoot.querySelectorAll<
          HTMLElement & { label?: string }
        >('[data-key^="table:"][data-key$=":switch"], [data-key^="guide:"][data-key$=":switch"]'),
      ].map((found) => `${found.getAttribute("data-key")}=${found.label ?? ""}`),
    );
  const labelsBefore = await allLabels();

  const box = (await toggle.boundingBox())!;
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const scrollTop = () =>
    sheet(page).evaluate(
      (element) =>
        (element as unknown as { elementOf(k: string): HTMLElement | null }).elementOf("lower")?.scrollTop ?? 0,
    );
  const scrolledBefore = await scrollTop();
  await drag(page, true, start, { x: start.x, y: start.y - 120 });
  await waitFor(async () => ((await scrollTop()) > scrolledBefore ? true : null), "the group scrolled", 5000);
  // The lift landed over a row or a switch: none of them fired.
  expect(await switchLabel(page, key!)).toBe(before);
  expect(await allLabels()).toEqual(labelsBefore);
  expect((await sheet(page).count()) > 0).toBe(true);
});
