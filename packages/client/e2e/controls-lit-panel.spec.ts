import { expect, test, type Page } from "@playwright/test";
import { pressKey, trackPageErrors } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Settings ▸ Controls is one Lit element over the canvas (`mc-controls-page`): the tab rail, the choice cells, the
 * switches, the Hint size slider and the shortcut lists are DOM, the controller drawing is an inline SVG whose labels are
 * text, the keyboard walks the rows with the ring drawn in the panel layer, and Escape closes it.
 */

const page_ = (page: Page) => page.locator('#mc-ui [data-scene="ControlsOverlay"] mc-controls-page');
/** A focus stop (`data-stop`) or, for the scrolling body and the slider's row, a `data-key`. */
const key = (page: Page, id: string) => page_(page).locator(`[data-stop="${id}"], [data-key="${id}"]`);

test("Controls is a panel: tabs switch, a switch flips, the slider steps, Escape closes", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openApp(page, "screen=controls&pad=xbox", { landing: "ControlsOverlay" });
  await expect(page_(page)).toBeVisible();

  // The controller tab draws the drawing as an SVG with its captions as text.
  await expect(page_(page).locator("mc-controller-diagram svg text").first()).toBeVisible();
  await expect(key(page, "row:hintSize")).toBeAttached();

  // The keyboard tab swaps the rows.
  await key(page, "tab:keyboard").click();
  await expect(key(page, "row:hand:left")).toBeVisible();
  await expect(page_(page).locator("mc-controller-diagram")).toHaveCount(0);

  // The hints switch flips (its word says ON or OFF), and "+" steps the hint size.
  const hints = key(page, "row:hints");
  const word = () => hints.locator(".switch").textContent();
  const before = await word();
  await hints.click();
  await expect.poll(word).not.toBe(before);
  const label = page_(page).locator("mc-volume-slider .label");
  const size = parseInt((await label.textContent()) ?? "0", 10);
  await key(page, "hint-size:up").click();
  await expect(label).toHaveText(`${size + 5}%`);

  // Down from the header: the ring is drawn over the panel.
  await pressKey(page, "ArrowDown");
  await expect(page.locator("#mc-ui .mc-focus-ring")).toBeVisible();

  await pressKey(page, "Escape");
  await expect(page_(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});
