import { expect, test, type Page } from "@playwright/test";
import { trackPageErrors } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * The key and button glyphs on the Lit panels (`dom/sheet-glyphs.ts`, drawn by `@mc/ui`'s `mc-glyph`): the generic
 * confirm shows B beside Keep playing and A / Start beside the primary on a pad, the keycap on a keyboard, folds away
 * while the mouse moves, and never shows on touch. Same glyphs, place and behaviour as the Phaser hints.
 */

const CONFIRM = "EndTurnConfirmOverlay";
const PAD_ID = "Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)";
const DPAD_DOWN = 13;

const confirmSheet = (page: Page) => page.locator(`#mc-ui [data-scene="${CONFIRM}"] mc-sheet`);
const glyphs = (page: Page) => confirmSheet(page).locator("mc-glyph");

async function installPad(page: Page): Promise<void> {
  await page.addInitScript((id) => {
    const button = () => ({ pressed: false, touched: false, value: 0 });
    const pad = {
      connected: true,
      id,
      index: 0,
      mapping: "standard",
      timestamp: 0,
      buttons: Array.from({ length: 17 }, button),
      axes: [0, 0, 0, 0],
    };
    (window as unknown as { __fakePad: unknown }).__fakePad = pad;
    Object.defineProperty(navigator, "getGamepads", {
      value: () => {
        pad.timestamp = performance.now();
        return [pad];
      },
      configurable: true,
    });
  }, PAD_ID);
}

async function tapPadButton(page: Page, index: number): Promise<void> {
  const set = (down: boolean) =>
    page.evaluate(
      ([i, on]) => {
        const pad = (window as unknown as { __fakePad: { buttons: unknown[] } }).__fakePad;
        pad.buttons[i as number] = { pressed: on, touched: on, value: on ? 1 : 0 };
      },
      [index, down] as const,
    );
  await set(true);
  await page.waitForTimeout(300);
  await set(false);
  await page.waitForTimeout(200);
}

async function openConfirm(page: Page): Promise<void> {
  await page.evaluate((key) => {
    const w = window as unknown as {
      __mcGame: { scene: { getScene(k: string): { scene: { launch(k: string, d: unknown): void } } } };
    };
    w.__mcGame.scene.getScene("PauseOverlay").scene.launch(key, {
      title: "Turn it on?",
      sentence: "This is a test warning.",
      confirmLabel: "Turn on",
      cancelLabel: "Cancel",
      from: "PauseOverlay",
      onConfirm: () => {},
      onCancel: () => {},
    });
  }, CONFIRM);
  await expect(confirmSheet(page)).toBeVisible();
}

test("with a pad, the confirm shows B beside Keep playing and Menu beside the primary, drawn as inline svg", async ({
  page,
}) => {
  const errors = trackPageErrors(page);
  await installPad(page);
  await openApp(page, "screen=pause", { landing: "PauseOverlay" });
  await tapPadButton(page, DPAD_DOWN);
  await openConfirm(page);
  await expect(glyphs(page)).toHaveCount(2);
  await expect(glyphs(page).first()).toHaveAttribute("aria-label", "B");
  await expect(glyphs(page).nth(1)).toHaveAttribute("aria-label", "Menu");
  // Inline svg, never a picture element, and fully open while the mouse rests.
  expect(
    await glyphs(page)
      .first()
      .evaluate((el) => el.shadowRoot!.querySelectorAll("img, svg").length),
  ).toBeGreaterThan(0);
  expect(
    await glyphs(page)
      .first()
      .evaluate((el) => el.shadowRoot!.querySelectorAll("img").length),
  ).toBe(0);
  await expect(glyphs(page).first()).toHaveCSS("opacity", "1");
  // Beside the word: the glyph sits inside its button, left of the label.
  const button = await confirmSheet(page).locator('mc-button[data-key="cancel"]').boundingBox();
  const glyph = await glyphs(page).first().boundingBox();
  expect(glyph!.x).toBeGreaterThanOrEqual(button!.x);
  expect(glyph!.x + glyph!.width).toBeLessThanOrEqual(button!.x + button!.width);
  expect(errors).toEqual([]);
});

test("the glyphs fold away while the mouse moves", async ({ page }) => {
  const errors = trackPageErrors(page);
  await installPad(page);
  await openApp(page, "screen=pause", { landing: "PauseOverlay" });
  await tapPadButton(page, DPAD_DOWN);
  await openConfirm(page);
  await expect(glyphs(page).first()).toHaveCSS("opacity", "1");
  await page.mouse.move(300, 300);
  await page.mouse.move(340, 320);
  await expect(glyphs(page).first()).toHaveCSS("opacity", "0");
  expect(errors).toEqual([]);
});

test("with a keyboard, the confirm shows the keycap beside Keep playing", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openApp(page, "screen=pause", { landing: "PauseOverlay" });
  await page.keyboard.press("ArrowDown");
  await openConfirm(page);
  await expect(glyphs(page).first()).toHaveCount(1);
  await expect(glyphs(page).first().locator("svg text")).toHaveCount(1);
  expect(errors).toEqual([]);
});
