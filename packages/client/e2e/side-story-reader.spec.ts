import { expect, test, type Page } from "@playwright/test";
import { activeScenes, settle, waitFor } from "./helpers.js";
import { clickStop, routeStops, trackErrors, waitForScene } from "./wave6-helpers-a.js";
import { hook, openApp } from "./wave6-helpers-b.js";

/**
 * Extras ▸ Side Stories: Thor and She-Hulk's date is locked until its achievement is earned, and once open, READ
 * reads it in the side-story reader beat by beat, every page panel by panel and then whole, and DONE comes back to
 * the Side Stories tab.
 */

const TILE = "tile:side:thor-she-hulk-badlands-date";

const beat = (page: Page) => hook<number>(page, "__mcSideStoryDebug", "beat");

test("a locked side story stays on the shelf", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await openApp(page, "screen=extras&tab=side", { landing: "Extras" });
  await waitForScene(page, "Extras");
  await settle(page);
  await clickStop(page, TILE, "Extras");
  await settle(page);
  expect(await activeScenes(page)).not.toContain("SideStoryReader");
  expect(errors).toEqual([]);
});

test("an open side story reads beat by beat, ends on the last page whole, and DONE returns to the tab", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await openApp(page, "unlock=all&screen=extras&tab=side", { landing: "Extras" });
  await waitForScene(page, "Extras");
  await settle(page);
  await clickStop(page, TILE, "Extras");
  await waitForScene(page, "SideStoryReader");
  const total = await waitFor(
    async () => (await hook<number>(page, "__mcSideStoryDebug", "beats")) ?? null,
    "hook",
    8000,
  );
  // Pages 6, 11 and 16 by panel plus the whole page (5, 7 and 7 beats), then page 17's close-up and whole page.
  expect(total).toBe(21);
  const pages: string[] = [];
  for (let index = 0; index < total; index++) {
    await waitFor(async () => ((await beat(page)) === index ? true : null), `beat ${index + 1}`, 8000);
    const file = (await hook<string>(page, "__mcSideStoryDebug", "page"))!;
    if (pages.at(-1) !== file) pages.push(file);
    if (index < total - 1) await clickStop(page, "next", "SideStoryReader");
  }
  expect(pages).toEqual(["page-06", "page-11", "page-16", "page-17"]);
  await clickStop(page, "back", "SideStoryReader");
  await waitFor(async () => ((await beat(page)) === total - 2 ? true : null), "back one beat", 8000);
  await clickStop(page, "next", "SideStoryReader");
  await waitFor(async () => ((await beat(page)) === total - 1 ? true : null), "the last beat again", 8000);
  await clickStop(page, "next", "SideStoryReader");
  await waitForScene(page, "Extras");
  // Back on the Side Stories tab: its tile is on the shelf.
  await waitFor(
    async () => ((await routeStops(page, "Extras"))?.stops.some((s) => s.key === TILE) ? true : null),
    "the Side Stories shelf",
    8000,
  );
  expect(errors).toEqual([]);
});
