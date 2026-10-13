import { expect, test, type Page } from "@playwright/test";
import { clickText, findText, trackPageErrors, waitForText } from "./helpers.js";
import { routeStops } from "./wave6-helpers-a.js";
import { openApp, startGame } from "./wave6-helpers-b.js";

/**
 * The native apps' update banner on Title (`platform/update-check.ts`): an install is told about a newer GitHub
 * release only when that release carries an installer for its platform, and is given the changelog and its installer. The page is made to look like the Android app (Capacitor's
 * global and an Android user agent) and GitHub's answer is stubbed, so nothing here reaches the network.
 */

const REPO = "https://github.com/quincarter/marvel-champions-digital-game";
const APK_URL = `${REPO}/releases/download/v999.0.0/marvel-champions-999.0.0.apk`;
const NOTES_URL = `${REPO}/releases/tag/v999.0.0`;
const EXE_URL = `${REPO}/releases/download/v999.0.0/Marvel.Champions_999.0.0_x64-setup.exe`;

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

/**
 * Every optional row at once (Continue, the update banner's two buttons, Civil War!) at the sizes the menu is
 * squeezed at: no control leaves the screen or covers another. A saved game gives Continue (a game started through the
 * store autosaves), `unlock=all` gives Civil War!, and the stubbed release gives the banner.
 */
const FIT_SIZES = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

for (const size of FIT_SIZES) {
  test(`the Title with every row (Continue, Civil War!, the update banner) fits at ${size.width}x${size.height}`, async ({
    page,
  }) => {
    const errors = trackPageErrors(page);
    await page.setViewportSize(size);
    await openAsAndroidApp(page, [APK_URL]);
    await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 4 });
    await page.reload();
    await waitForText(page, "Update available", { sceneKey: "Title" });
    await waitForText(page, "Continue", { sceneKey: "Title" });
    await waitForText(page, "Civil War!", { sceneKey: "Title" });
    await page.waitForTimeout(500);

    const shots = process.env.TITLE_FIT_SHOTS;
    if (shots) {
      await page.screenshot({
        path: `${shots}/wave10-title-fit-${size.width}x${size.height}-${process.env.TITLE_FIT_TAG}.png`,
      });
    }

    const stops = (await routeStops(page, "Title"))?.stops ?? [];
    const keys = stops.map((stop) => stop.key);
    for (const key of ["continue", "new-game", "campaign", "civil-war", "settings", "release-notes"])
      expect(keys, `${key} is a stop`).toContain(key);
    for (const stop of stops) {
      const r = stop.rect;
      expect(r.x, `${stop.key} left`).toBeGreaterThanOrEqual(0);
      expect(r.y, `${stop.key} top`).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width, `${stop.key} right`).toBeLessThanOrEqual(size.width);
      expect(r.y + r.height, `${stop.key} bottom`).toBeLessThanOrEqual(size.height);
    }
    for (let i = 0; i < stops.length; i++) {
      for (let j = i + 1; j < stops.length; j++) {
        const a = stops[i]!.rect;
        const b = stops[j]!.rect;
        const apart = a.x >= b.x + b.width || b.x >= a.x + a.width || a.y >= b.y + b.height || b.y >= a.y + a.height;
        expect(apart, `${stops[i]!.key} and ${stops[j]!.key} overlap`).toBe(true);
      }
    }
    expect(errors).toEqual([]);
  });
}
