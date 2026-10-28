import { expect, test, type Page } from "@playwright/test";
import { clickText, settle, waitFor } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Issue #479: the Trophy Room's families fold. Every one starts folded, a tap on a heading opens it, and the room
 * remembers which are open on the next visit. A Filters bar, folded too, sorts the families (and what is in them).
 */

const stops = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    (window as unknown as { __mcFocusRoutes: Record<string, () => { key: string }[]> }).__mcFocusRoutes
      .TrophyRoom!().map((s) => s.key),
  );

const rowsShown = async (page: Page): Promise<number> => (await stops(page)).filter((k) => k.startsWith("row:")).length;

test("families start folded, open with a tap, and stay open on the next visit", async ({ page }) => {
  await openApp(page, "screen=trophies&unlock=all", { landing: "TrophyRoom" });
  await waitFor(async () => ((await stops(page)).includes("sec:wins") ? true : null), "the headings", 30_000);
  expect(await rowsShown(page), "every family starts folded").toBe(0);

  await clickText(page, "BATTLES WON", { sceneKey: "TrophyRoom" });
  await waitFor(async () => ((await rowsShown(page)) > 0 ? true : null), "Battles won opens", 10_000);
  const open = await rowsShown(page);

  await page.reload();
  await waitFor(async () => ((await stops(page).catch(() => [])).includes("sec:wins") ? true : null), "back", 30_000);
  await settle(page);
  expect(await rowsShown(page), "the open family is remembered").toBe(open);

  await clickText(page, "BATTLES WON", { sceneKey: "TrophyRoom" });
  await waitFor(async () => ((await rowsShown(page)) === 0 ? true : null), "Battles won folds again", 10_000);
});

test("the Filters bar opens and sorts the families A–Z, then back the other way", async ({ page }) => {
  await openApp(page, "screen=trophies&unlock=all", { landing: "TrophyRoom" });
  await waitFor(async () => ((await stops(page)).includes("filters-toggle") ? true : null), "the bar", 30_000);
  expect(await stops(page), "the sort chips start folded").not.toContain("sort:name");

  await clickText(page, "Sort:", { sceneKey: "TrophyRoom" });
  await waitFor(async () => ((await stops(page)).includes("sort:name") ? true : null), "the chips show", 10_000);
  await clickText(page, "A–Z", { sceneKey: "TrophyRoom" });
  const headings = async (): Promise<string[]> => (await stops(page)).filter((k) => k.startsWith("sec:"));
  // "Villains" comes second in the book's order; A–Z puts "Boxes and campaigns" there.
  await waitFor(async () => ((await headings())[1] === "sec:campaigns" ? true : null), "sorted A–Z", 10_000);
  await clickText(page, "DESCENDING", { sceneKey: "TrophyRoom" });
  await waitFor(async () => ((await headings())[0] === "sec:villains" ? true : null), "sorted Z–A", 10_000);
});
