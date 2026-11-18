import { expect, test, type Page } from "@playwright/test";
import {
  activeScenes,
  clickText,
  findText,
  installPageHelpers,
  isSceneUp,
  settle,
  trackPageErrors,
  waitFor,
} from "./helpers.js";
import { communityHeroPackIds, serveCatalog, stageCatalog } from "./pack-catalog-helpers.js";
import { waitForScene } from "./wave6-helpers-a.js";
import { quietGuide } from "./wave6-helpers-b.js";

/** The text of each count badge drawn now in the Title, by control (`count-badge:<control>`). */
const titleBadges = (page: Page): Promise<Record<string, string>> =>
  page.evaluate(() => {
    interface Obj {
      name?: string;
      text?: string;
      visible?: boolean;
    }
    const game = (
      window as unknown as { __mcGame: { scene: { getScene(key: string): { children: { list: Obj[] } } | null } } }
    ).__mcGame;
    const badges: Record<string, string> = {};
    for (const child of game.scene.getScene("Title")?.children.list ?? []) {
      if (child.visible !== false && child.name?.startsWith("count-badge:")) {
        badges[child.name.slice("count-badge:".length)] = child.text ?? "";
      }
    }
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
  await waitForScene(page, "ModNoticeOverlay");
  await clickText(page, "Got it", { sceneKey: "ModNoticeOverlay" });
  await waitFor(async () => (!(await isSceneUp(page, "ModNoticeOverlay")) ? true : null), "the notice closes");
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
