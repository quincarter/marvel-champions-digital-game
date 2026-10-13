import { expect, test, type Page } from "@playwright/test";
import { clickText, findText, trackPageErrors, waitForText } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * The native apps' update banner on Title (`platform/update-check.ts`): an install is told about a newer GitHub
 * release only when that release carries an installer for its platform, and is given the changelog and its installer. The page is made to look like the Android app (Capacitor's
 * global and an Android user agent) and GitHub's answer is stubbed, so nothing here reaches the network.
 */

const REPO = "https://github.com/quincarter/marvel-champions-digital-game";
const APK_URL = `${REPO}/releases/download/v999.0.0/MarvelChampions-999.0.0-Android.apk`;
const NOTES_URL = `${REPO}/releases/tag/v999.0.0`;
const EXE_URL = `${REPO}/releases/download/v999.0.0/MarvelChampions-999.0.0-Windows-x64-Setup.exe`;

test.use({
  userAgent: "Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36",
});

async function openAsAndroidApp(page: Page, assetUrls: readonly string[]): Promise<void> {
  await page.addInitScript(() => {
    const shell = window as unknown as { Capacitor: object; __opened: string[] };
    shell.Capacitor = { isNativePlatform: () => true };
    shell.__opened = [];
    window.open = (url) => {
      shell.__opened.push(String(url));
      return null;
    };
  });
  await page.route("https://api.github.com/**", (route) =>
    route.fulfill({
      json: {
        tag_name: "v999.0.0",
        html_url: NOTES_URL,
        draft: false,
        prerelease: false,
        assets: assetUrls.map((url) => ({ name: url.split("/").at(-1), browser_download_url: url })),
      },
    }),
  );
  await openApp(page);
}

const opened = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);

/** Presses a banner button until it has opened something, and says what. */
async function pressBanner(page: Page, label: string): Promise<string[]> {
  await page.evaluate(() => {
    (window as unknown as { __opened: string[] }).__opened = [];
  });
  await clickText(page, label, {
    sceneKey: "Title",
    until: async () => (await opened(page)).length > 0,
    untilLabel: `"${label}" opens a link`,
  });
  return [...new Set(await opened(page))];
}

test("an Android install is offered a newer release: its changelog and its APK", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openAsAndroidApp(page, [APK_URL, EXE_URL]);

  await waitForText(page, "Update available", { sceneKey: "Title" });
  expect(await findText(page, "Version 999.0.0", "Title")).toHaveLength(1);

  expect(await pressBanner(page, "Download")).toEqual([APK_URL]);
  expect(await pressBanner(page, "What's new")).toEqual([NOTES_URL]);
  expect(errors).toEqual([]);
});

test("a newer release with no APK is not offered to an Android install", async ({ page }) => {
  const errors = trackPageErrors(page);
  const asked = page.waitForResponse("https://api.github.com/**");
  await openAsAndroidApp(page, [EXE_URL]);
  await asked;

  await waitForText(page, "Release notes", { sceneKey: "Title" });
  // The answer has arrived and been turned down; give a redraw the chance to happen before saying it didn't.
  await page.waitForTimeout(500);
  expect(await findText(page, "Update available", "Title")).toEqual([]);
  expect(errors).toEqual([]);
});
