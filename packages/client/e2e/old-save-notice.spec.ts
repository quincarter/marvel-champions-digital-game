import { expect, test, type Page } from "@playwright/test";
import { clickText, findText, trackPageErrors, waitForText } from "./helpers.js";
import { routeStops } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * The web game's "Looking for your old save?" banner on Title (issue #723, `platform/old-save-notice.ts`). It shows
 * only at the game's new address, so `?oldsave=1` stands in for that here. Its button opens the moved page at the old
 * address, and closing it is remembered across visits.
 */

const OLD_PAGE = "https://marvel-champions-digital-game.netlify.app/";
const HEADING = "Looking for your old save?";

async function captureOpens(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const shell = window as unknown as { __opened: string[] };
    shell.__opened = [];
    window.open = (url) => {
      shell.__opened.push(String(url));
      return null;
    };
  });
}

const opened = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);

const stopKeys = async (page: Page): Promise<string[]> =>
  ((await routeStops(page, "Title"))?.stops ?? []).map((stop) => stop.key);

test("the old-save banner opens the moved page, and once closed it stays closed", async ({ page }) => {
  const errors = trackPageErrors(page);
  await captureOpens(page);
  await openApp(page, "unlock=all&oldsave=1");

  await waitForText(page, HEADING, { sceneKey: "Title" });
  expect(await stopKeys(page)).toEqual(expect.arrayContaining(["old-save-open", "update-dismiss"]));

  await clickText(page, "Recover", {
    sceneKey: "Title",
    until: async () => (await opened(page)).length > 0,
    untilLabel: "Recover opens the old page",
  });
  expect([...new Set(await opened(page))]).toEqual([OLD_PAGE]);

  await clickText(page, "×", {
    sceneKey: "Title",
    until: async () => (await findText(page, HEADING, "Title")).length === 0,
    untilLabel: "the close button hides the banner",
  });
  expect(await stopKeys(page)).not.toContain("old-save-open");

  await page.reload();
  await waitForText(page, "Release notes", { sceneKey: "Title" });
  await page.waitForTimeout(500);
  expect(await findText(page, HEADING, "Title")).toEqual([]);
  expect(errors).toEqual([]);
});

test("the old-save banner is not shown on other web addresses without ?oldsave=1", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openApp(page);
  await waitForText(page, "Release notes", { sceneKey: "Title" });
  await page.waitForTimeout(500);
  expect(await findText(page, HEADING, "Title")).toEqual([]);
  expect(errors).toEqual([]);
});

const FIT_SIZES = [
  { width: 375, height: 667 },
  { width: 412, height: 924 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

for (const size of FIT_SIZES) {
  test(`the old-save banner's buttons stay on screen at ${size.width}x${size.height}`, async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.setViewportSize(size);
    await openApp(page, "unlock=all&oldsave=1");
    await waitForText(page, HEADING, { sceneKey: "Title" });
    const stops = (await routeStops(page, "Title"))?.stops ?? [];
    for (const key of ["old-save-open", "update-dismiss"]) {
      const stop = stops.find((s) => s.key === key);
      expect(stop, key).toBeDefined();
      const rect = stop!.rect;
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(size.width);
      expect(rect.y + rect.height).toBeLessThanOrEqual(size.height);
    }
    expect(errors).toEqual([]);
  });
}
