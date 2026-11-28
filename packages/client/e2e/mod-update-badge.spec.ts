import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, findText, installPageHelpers, settle, trackPageErrors, waitFor } from "./helpers.js";
import { communityHeroPackIds, serveCatalog, stageCatalog, answerModNotice } from "./pack-catalog-helpers.js";
import { waitForScene } from "./wave6-helpers-a.js";
import { quietGuide } from "./wave6-helpers-b.js";

/**
 * The text of each count badge drawn now in the Title, by control: the storefront icon's is on its `mc-icon-button`
 * in the top row, the Mod Store row's on its `mc-title-menu-button` in the menu (each a `.badge`).
 */
const titleBadges = (page: Page): Promise<Record<string, string>> =>
  page.evaluate(() => {
    const badges: Record<string, string> = {};
    const view = (selector: string): ParentNode | null =>
      document.querySelector('#mc-ui [data-scene="Title"] mc-title-page')?.shadowRoot?.querySelector(selector) ?? null;
    const row = (view("mc-title-menu") as Element | null)?.shadowRoot
      ?.querySelector('mc-title-menu-button[data-key="mod-store"]')
      ?.shadowRoot?.querySelector(".badge");
    if (row?.textContent) badges["mod-store"] = row.textContent.trim();
    const icon = (view("mc-title-icon-row") as Element | null)?.shadowRoot
      ?.querySelector('mc-icon-button[data-stop="chrome:mod-store"]')
      ?.shadowRoot?.querySelector(".badge");
    if (icon?.textContent) badges["store-icon"] = icon.textContent.trim();
    return badges;
  });

/**
 * An installed mod pack the store has a newer version of: the Title's Mod Store button (and, on a tablet or desktop,
 * its storefront icon in the top row) wears a count badge. Before the store lists anything newer there is no badge.
 */
test("the Title counts installed mod packs with an update", async ({ page, baseURL }) => {
  test.setTimeout(240_000);
  const [packId] = communityHeroPackIds();
  expect(packId, "a community hero pack (pnpm packs:fetch)").toBeTruthy();
  const staged = await stageCatalog(baseURL!, [packId!]);
  const errors = trackPageErrors(page);
  await serveCatalog(page, staged);
  await installPageHelpers(page);
  await quietGuide(page);

  // Install the pack from its store page.
  await page.goto(`/?screen=mod-store&pack=${packId}`);
  await waitForScene(page, "ModStore");
  await answerModNotice(page);
  await settle(page);
  await clickText(page, "INSTALL (", { sceneKey: "ModStore", timeoutMs: 30_000 });
  await waitFor(
    async () => ((await findText(page, "REMOVE", "ModStore")).length > 0 ? true : null),
    `${packId} installs`,
    90_000,
  );

  // Up to date: the Title shows no badge.
  const toTitle = async (): Promise<void> => {
    for (let i = 0; i < 10 && !(await activeScenes(page)).includes("Title"); i++) {
      await page.keyboard.press("Escape");
      await settle(page);
      await page.waitForTimeout(500);
    }
    await waitForScene(page, "Title");
    await settle(page);
  };
  await toTitle();
  // Give the Title's check time to land: still no badge.
  await page.waitForTimeout(3000);
  expect(await titleBadges(page)).toEqual({});

  // The store now lists a newer version: a fresh session's Title checks the catalog and counts it.
  const index = staged.index as { packs: { id: string; latest: string; versions: Record<string, unknown> }[] };
  const entry = index.packs.find((pack) => pack.id === packId)!;
  entry.versions["99.0.0"] = entry.versions[entry.latest];
  entry.latest = "99.0.0";
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await serveCatalog(page, staged);
  await page.goto("/");
  await waitForScene(page, "Title");
  const badges = await waitFor(async () => {
    const found = await titleBadges(page);
    return found["mod-store"] ? found : null;
  }, "the Mod Store button's badge");
  expect(badges["mod-store"]).toBe("1");
  // A phone's top row has no storefront icon; the menu item carries the badge alone.
  if (test.info().project.name === "phone") expect(badges["store-icon"]).toBeUndefined();
  else expect(badges["store-icon"]).toBe("1");
  expect(errors).toEqual([]);
  staged.dispose();
});
