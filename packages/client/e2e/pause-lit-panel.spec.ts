import { expect, test, type Page } from "@playwright/test";
import { pressKey, trackPageErrors, waitFor } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Pause is one page element, `mc-pause-page` (`views/pause/`), over the canvas, made of section elements
 * (`components/pause/`): the keyboard walks its stops with the DOM focus ring and Enter presses Resume, on a phone a swipe
 * that lifts over a switch only scrolls the page (CLAUDE.md, no tap on finger lift), the ✕ is a 44px press target, and on a
 * short screen (a phone held sideways) no button is drawn over another and every one can be reached.
 */

type States = Record<string, () => { focus: string | null; ringShown: boolean }>;

const page_ = (page: Page) => page.locator('#mc-ui [data-scene="PauseOverlay"] mc-pause-page');
const stop = (page: Page, key: string) => page_(page).locator(`[data-stop="${key}"]`);

const focusState = (page: Page) =>
  page.evaluate(() => (window as unknown as { __mcFocusState: States }).__mcFocusState.PauseOverlay!());

/** Every switch row's key and state word, so a lift that fired any of them would show. */
const switchStates = (page: Page): Promise<string[]> =>
  page_(page).evaluate((element) => {
    const out: string[] = [];
    const visit = (root: ParentNode): void => {
      for (const found of root.querySelectorAll<HTMLElement & { state?: string }>("*")) {
        if (found.localName === "mc-switch-row") out.push(`${found.getAttribute("data-stop")}=${found.state ?? ""}`);
        if (found.shadowRoot) visit(found.shadowRoot);
      }
    };
    visit(element as unknown as ParentNode);
    return out;
  });

/** The page's scrolling body, read from its shadow root. */
const bodyScroll = (page: Page): Promise<number> =>
  page_(page).evaluate((element) => element.shadowRoot!.querySelector<HTMLElement>(".body")?.scrollTop ?? 0);

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

test("Pause is a page of elements the keyboard walks, and Enter on Resume closes it", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openApp(page, "screen=pause", { landing: "PauseOverlay" });
  await expect(page_(page)).toBeVisible();
  await expect(stop(page, "resume")).toBeVisible();

  // Down through the stops until the ring is on Resume: it is drawn over the panel.
  let focus: string | null = null;
  for (let i = 0; i < 40 && focus !== "resume"; i++) {
    await pressKey(page, "ArrowDown");
    focus = (await focusState(page)).focus;
  }
  expect(focus).toBe("resume");
  await expect(page.locator("#mc-ui .mc-focus-ring")).toBeVisible();

  await pressKey(page, "Enter");
  await expect(page_(page)).toHaveCount(0, { timeout: 10000 });
  expect(errors).toEqual([]);
});

test("on a phone, a swipe that lifts over a switch only scrolls the page", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "the Table group is the phone sheet's");
  await openApp(page, "screen=pause", { landing: "PauseOverlay" });
  await expect(page_(page)).toBeVisible();
  const toggle = page_(page).locator('mc-switch-row[data-stop^="table:"]').first();
  await expect(toggle).toBeVisible();
  const statesBefore = await switchStates(page);
  expect(statesBefore.length).toBeGreaterThan(0);

  const box = (await toggle.boundingBox())!;
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const scrolledBefore = await bodyScroll(page);
  await drag(page, true, start, { x: start.x, y: start.y - 120 });
  await waitFor(async () => ((await bodyScroll(page)) > scrolledBefore ? true : null), "the page scrolled", 5000);
  // The lift landed over a row or a switch: none of them fired.
  expect(await switchStates(page)).toEqual(statesBefore);
  await expect(page_(page)).toBeVisible();
});

test("on a phone, the ✕ is a 44px press target and a tap on it closes Pause", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "the ✕ is the phone sheet's");
  await openApp(page, "screen=pause", { landing: "PauseOverlay" });
  await expect(page_(page)).toBeVisible();
  const box = (await stop(page, "close").boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page_(page)).toHaveCount(0, { timeout: 10000 });
});

test("on a short screen the menu draws no button over another, and every one can be reached", async ({
  page,
}, info) => {
  test.skip(info.project.name === "phone", "the short wide layout is checked at its own size, below");
  await page.setViewportSize({ width: 860, height: 360 });
  await openApp(page, "screen=pause", { landing: "PauseOverlay" });
  await expect(page_(page)).toBeVisible();
  const keys = [
    "resume",
    "full-game-log",
    "rules-reference",
    "settings",
    "stats",
    "save-quit",
    "music",
    "report",
    "concede",
  ];
  // No two buttons overlap, wherever they sit (scrolled out of view or not).
  const boxes = [];
  for (const key of keys) {
    const found = (await stop(page, key).boundingBox())!;
    expect(found, `${key} is drawn`).not.toBeNull();
    boxes.push({ key, ...found });
  }
  for (const [i, a] of boxes.entries())
    for (const b of boxes.slice(i + 1)) {
      const apart =
        a.x + a.width <= b.x + 0.5 ||
        b.x + b.width <= a.x + 0.5 ||
        a.y + a.height <= b.y + 0.5 ||
        b.y + b.height <= a.y + 0.5;
      expect(apart, `${a.key} and ${b.key} overlap`).toBe(true);
    }
  // Concede can be scrolled to and pressed: the menu column scrolls where the screen is short.
  await stop(page, "concede").scrollIntoViewIfNeeded();
  const concede = (await stop(page, "concede").boundingBox())!;
  expect(concede.y + concede.height).toBeLessThanOrEqual(360);
  expect(concede.y).toBeGreaterThanOrEqual(0);
});
