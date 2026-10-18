import { expect, test, type Page } from "@playwright/test";
import { findText, waitFor } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Power saving mode (`platform/power-saving.ts`). The Android app reads it from the OS; `?powersave=1` forces it on
 * anywhere, which is what this drives. While it is on the frame rate is capped at 30, a notice drops in at the bottom
 * of the screen and the Title footer says so. Separately, on Android the music pauses while the game is in the
 * background and plays again when it comes back (`platform/app-background.ts`).
 */

interface GameHandle {
  readonly loop: { readonly fpsLimit: number };
  readonly scene: { getScene(key: string): unknown };
}

const game = <T>(page: Page, read: (game: GameHandle) => T): Promise<T> =>
  page.evaluate(`(${read.toString()})(window.__mcGame)`) as Promise<T>;

const noticeState = (page: Page) =>
  game(page, (g) =>
    (
      g.scene.getScene("PowerSavingNotice") as { debugState(): { showing: boolean; powerSaving: boolean } }
    ).debugState(),
  );

test("power saving forced on: a 30 fps cap, the notice and the Title footer line", async ({ page }) => {
  test.setTimeout(90_000);
  await openApp(page, "unlock=all&powersave=1");
  await waitFor(async () => ((await noticeState(page)).showing ? true : null), "the power saving notice", 15_000);
  expect((await noticeState(page)).powerSaving).toBe(true);
  expect(await game(page, (g) => g.loop.fpsLimit)).toBe(30);
  expect(await findText(page, "Power saving detected", "Title")).not.toHaveLength(0);
  // The notice leaves on its own.
  await waitFor(async () => ((await noticeState(page)).showing ? null : true), "the notice goes away", 15_000);
});

test("lighter play turned off in Settings: power saving is shown but changes nothing", async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() =>
    localStorage.setItem("mc-settings", JSON.stringify({ version: 1, powerSavingAdjust: false })),
  );
  await openApp(page, "unlock=all&powersave=1");
  await waitFor(async () => ((await noticeState(page)).showing ? true : null), "the power saving notice", 15_000);
  expect(await game(page, (g) => g.loop.fpsLimit)).toBe(0);
  expect(await findText(page, "lighter play off", "Title")).not.toHaveLength(0);
});

test("no power saving: no cap, no notice, no footer line", async ({ page }) => {
  test.setTimeout(90_000);
  await openApp(page, "unlock=all");
  expect((await noticeState(page)).showing).toBe(false);
  expect(await game(page, (g) => g.loop.fpsLimit)).toBe(0);
  expect(await findText(page, "Power saving detected", "Title")).toHaveLength(0);
});

test.describe("on Android", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
  });

  /** Tells the page it was hidden or shown, as Android does when the app leaves or returns to the foreground. */
  const setHidden = (page: Page, hidden: boolean) =>
    page.evaluate((value) => {
      Object.defineProperty(document, "hidden", { value, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    }, hidden);

  const musicPaused = (page: Page) =>
    game(page, (g) => (g.scene.getScene("MusicScene") as { paused(): boolean }).paused());

  test("the music pauses in the background and plays again on return", async ({ page }) => {
    test.setTimeout(90_000);
    await openApp(page);
    expect(await musicPaused(page)).toBe(false);
    await setHidden(page, true);
    expect(await musicPaused(page)).toBe(true);
    await setHidden(page, false);
    expect(await musicPaused(page)).toBe(false);
  });
});
