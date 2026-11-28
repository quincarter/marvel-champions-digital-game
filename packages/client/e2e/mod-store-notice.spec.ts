import { expect, test, type Page } from "@playwright/test";
import { installPageHelpers, pressKey, settle, trackPageErrors, waitFor } from "./helpers.js";
import { communityPackIds, serveCatalog, stageCatalog, type StagedCatalog } from "./pack-catalog-helpers.js";
import { waitForScene } from "./wave6-helpers-a.js";

/**
 * The first-run heads-up about mods is an element over the store (`mc-mod-notice`, in `mc-mod-store-page`), not a scene of
 * its own: it opens the first time the store does and from About mods, its backdrop takes every press, and answering it
 * (a button, or Escape) remembers it was seen. Run against a catalog served through `page.route`.
 */

const SCENE = "ModStore";
const page_ = (page: Page) => page.locator(`#mc-ui [data-scene="${SCENE}"] mc-mod-store-page`);
const key = (page: Page, name: string) => page_(page).locator(`[data-key="${name}"]`).first();
const notice = (page: Page) => page_(page).locator("mc-mod-notice");
const seen = (page: Page) => page.evaluate(() => localStorage.getItem("mc-mod-notice-seen"));

const focusOf = (page: Page) =>
  page.evaluate(
    (scene) =>
      (window as unknown as { __mcFocusState: Record<string, () => { focus: string | null }> }).__mcFocusState[
        scene
      ]!(),
    SCENE,
  );

let staged: StagedCatalog | undefined;

test.beforeAll(async ({ baseURL }) => {
  test.setTimeout(420_000);
  staged = await stageCatalog(baseURL!, communityPackIds().slice(0, 1));
});
test.afterAll(() => staged?.dispose());

/** Opens the store with the heads-up never answered. */
async function openStore(page: Page): Promise<void> {
  await installPageHelpers(page);
  await serveCatalog(page, staged!);
  await page.goto("/?screen=mod-store");
  await waitForScene(page, SCENE);
  await expect(notice(page)).toBeVisible({ timeout: 30_000 });
}

test("the first visit opens the heads-up over the store: both speakers, two answers, Got it first in the pad's order", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = trackPageErrors(page);
  await openStore(page);
  expect(await seen(page)).toBeNull();
  await expect(notice(page).locator(".who")).toHaveText(["Deadpool", "Spider-Man"]);
  await expect(key(page, "close")).toBeVisible();
  await expect(key(page, "report")).toBeVisible();
  await waitFor(async () => ((await focusOf(page)).focus === "close" ? true : null), "Got it holds the focus");
  expect(errors).toEqual([]);
});

test("Got it closes it and remembers it; About mods brings it back, and Escape answers it too", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackPageErrors(page);
  await openStore(page);
  await key(page, "close").click();
  await expect(notice(page)).toHaveCount(0);
  await settle(page);
  expect(await seen(page)).toBe("1");
  await key(page, "about").click();
  await expect(notice(page)).toBeVisible();
  await pressKey(page, "Escape");
  await expect(notice(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("its backdrop takes the press: a tab under it is not pressed", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackPageErrors(page);
  await openStore(page);
  const box = (await key(page, "tab:heroes").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await settle(page);
  await expect(notice(page)).toBeVisible();
  await key(page, "close").click();
  await expect(notice(page)).toHaveCount(0);
  await expect(key(page, "tab:all")).toHaveAttribute("selected", "");
  expect(errors).toEqual([]);
});

test("Report a problem answers it and opens the report tool", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackPageErrors(page);
  await openStore(page);
  await key(page, "report").click();
  await expect(notice(page)).toHaveCount(0);
  expect(await seen(page)).toBe("1");
  await waitForScene(page, "ReportIssueOverlay");
  expect(errors).toEqual([]);
});
