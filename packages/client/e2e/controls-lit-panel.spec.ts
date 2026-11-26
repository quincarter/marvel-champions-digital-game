import { expect, test, type Page } from "@playwright/test";
import { pressKey, trackPageErrors } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Settings ▸ Controls draws as a Lit panel over the canvas (`mc-sheet`): the tab rail, the choice cells, the switches,
 * the Hint size slider and the shortcut lists are DOM, the controller drawing is an inline SVG whose labels are text,
 * the keyboard walks the rows with the ring drawn in the panel layer, and Escape closes it.
 */

const sheet = (page: Page) => page.locator('#mc-ui [data-scene="ControlsOverlay"] mc-sheet');
const key = (page: Page, id: string) => sheet(page).locator(`[data-key="${id}"]`);

test("Controls is a panel: tabs switch, a switch flips, the slider steps, Escape closes", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openApp(page, "screen=controls&pad=xbox", { landing: "ControlsOverlay" });
  await expect(sheet(page)).toBeVisible();

  // The controller tab draws the drawing as an SVG with its captions as text.
  await expect(key(page, "controller").locator("text").first()).toBeVisible();
  await expect(key(page, "row:hintSize")).toBeAttached();

  // The keyboard tab swaps the rows.
  await key(page, "tab:keyboard").click();
  await expect(key(page, "row:hand:left")).toBeVisible();
  await expect(key(page, "controller")).toHaveCount(0);

  // The hints switch flips, and "+" steps the hint size.
  const hints = key(page, "row:hints:switch");
  const before = await hints.evaluate((el) => (el as HTMLElement & { label?: string }).label ?? null);
  await key(page, "row:hints").click();
  await expect
    .poll(() => hints.evaluate((el) => (el as HTMLElement & { label?: string }).label ?? null))
    .not.toBe(before);
  const label = key(page, "hint-size:label");
  const size = parseInt((await label.textContent()) ?? "0", 10);
  await key(page, "hint-size:up").click();
  await expect(label).toHaveText(`${size + 5}%`);

  // Down from the header: the ring is drawn over the panel.
  await pressKey(page, "ArrowDown");
  await expect(page.locator("#mc-ui .mc-focus-ring")).toBeVisible();

  await pressKey(page, "Escape");
  await expect(sheet(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});
