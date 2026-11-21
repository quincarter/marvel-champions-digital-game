import { expect, test, type Page } from "@playwright/test";
import { settle } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Issue #939: iOS zoomed the page in on a tapped text field and never back out. On an iPhone the viewport carries
 * `maximum-scale=1`, which is what stops that zoom; the deck builder's search still takes typing, and the page is at
 * its own scale after the field is left. Elsewhere the viewport is left alone, so Android keeps pinch zoom.
 */

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";

const viewport = (page: Page): Promise<string> =>
  page.evaluate(() => document.querySelector<HTMLMetaElement>('meta[name="viewport"]')?.content ?? "");

test.describe("on an iPhone", () => {
  test.use({ userAgent: IPHONE_UA });

  test("a text field never zooms the page", async ({ page }) => {
    test.setTimeout(120_000);
    await installWave6Helpers(page);
    await openApp(page, "screen=deck-builder", { landing: "DeckBuilder" });
    await settle(page);
    expect(await viewport(page)).toContain("maximum-scale=1");

    // The search is the empty field; on desktop the deck's name field is also on screen.
    const fields = page.locator("input").filter({ visible: true });
    const index = await fields.evaluateAll((els) => els.findIndex((el) => (el as HTMLInputElement).value === ""));
    expect(index, "an empty search field").toBeGreaterThanOrEqual(0);
    const search = fields.nth(index);
    await expect(search).toBeVisible();
    await search.click();
    await search.pressSequentially("hulk");
    await expect(search).toHaveValue("hulk");
    await search.press("Enter");
    await expect(search).not.toBeFocused();

    expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
    expect(await viewport(page)).toContain("maximum-scale=1");
  });
});

test.describe("on Android", () => {
  test.use({ userAgent: ANDROID_UA });

  test("the viewport keeps pinch zoom", async ({ page }) => {
    await installWave6Helpers(page);
    await openApp(page, "screen=deck-builder", { landing: "DeckBuilder" });
    expect(await viewport(page)).not.toContain("maximum-scale");
  });
});
