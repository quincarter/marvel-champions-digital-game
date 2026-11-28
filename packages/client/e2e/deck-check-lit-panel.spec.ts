import { expect, test, type Page } from "@playwright/test";
import { activeScenes, findText, pressKey, trackPageErrors, waitFor, waitForText } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";
import { clickStop, hasStop } from "./wave6-helpers-a.js";

/**
 * Deck check draws as Lit panels over the canvas (`mc-sheet` for the header, rail, panel, tabs and footer with the kit's
 * stat tiles, bar chart and line list; `mc-card-sections` for the deck's cards): its words are found under its scene, a
 * tap on a card opens Inspect, the type filter narrows the cards, the keyboard walks the same stops with the ring in the
 * DOM, Escape goes back, a phone's tabs switch, and the screen reads in Spanish.
 */

const panel = `#mc-ui [data-scene="DeckCheck"]`;
const URL = "screen=deck-check&unlock=all";

async function open(page: Page, query = URL): Promise<void> {
  await openApp(page, query, { landing: "DeckCheck" });
  await waitFor(async () => ((await hasStop(page, "back", "DeckCheck")) ? true : null), "Deck check is up", 20_000);
}

const wide = (page: Page): boolean => page.viewportSize()!.width >= 1000;

async function showCards(page: Page): Promise<void> {
  if (!wide(page)) await clickStop(page, "tab:cards", "DeckCheck");
  await waitFor(
    async () => ((await page.locator(`${panel} mc-card-sections [data-key^="card:"]`).count()) > 0 ? true : null),
    "the cards are listed",
    20_000,
  );
}

test("the screen is Lit panels: the legality badge, the cards and Edit deck are found under it", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await open(page);
  expect((await findText(page, "LEGAL", "DeckCheck")).length).toBeGreaterThan(0);
  expect((await findText(page, "Edit deck", "DeckCheck")).length).toBeGreaterThan(0);
  await showCards(page);
  expect(await page.locator(`${panel} mc-card-sections [data-key^="face:"]`).count()).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("a tap on a card opens Inspect", async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  await showCards(page);
  await page.locator(`${panel} mc-card-sections [data-key^="card:"]`).first().click();
  await waitFor(
    async () => ((await activeScenes(page)).includes("InspectOverlay") ? true : null),
    "Inspect opens",
    10_000,
  );
});

test("the type filter narrows the cards to that type (wide)", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "the filter chips are in the wide rail");
  test.setTimeout(120_000);
  await open(page);
  await showCards(page);
  const all = await page.locator(`${panel} mc-card-sections [data-key^="card:"]`).count();
  await clickStop(page, "filter:upgrade", "DeckCheck");
  await waitFor(
    async () => {
      const now = await page.locator(`${panel} mc-card-sections [data-key^="card:"]`).count();
      return now > 0 && now < all ? true : null;
    },
    "only upgrades are listed",
    15_000,
  );
  // The identity's faces are not cards: a filter drops them.
  expect(await page.locator(`${panel} mc-card-sections [data-key^="face:"]`).count()).toBe(0);
});

test("a phone's tabs switch between Curve, Cards and Aspect", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "the tabs are the narrow layout");
  test.setTimeout(120_000);
  await open(page);
  expect((await findText(page, "RESOURCE CURVE", "DeckCheck")).length).toBeGreaterThan(0);
  await clickStop(page, "tab:aspect", "DeckCheck");
  await waitForText(page, "COMPOSITION BY ASPECT", { sceneKey: "DeckCheck" });
  await clickStop(page, "tab:cards", "DeckCheck");
  await waitFor(
    async () => ((await page.locator(`${panel} mc-card-sections [data-key^="card:"]`).count()) > 0 ? true : null),
    "the cards tab lists cards",
    15_000,
  );
  expect(await hasStop(page, "deck-sort", "DeckCheck")).toBe(true);
});

test("the keyboard walks the stops with the ring in the DOM, and Escape goes back", async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  await pressKey(page, "ArrowDown");
  await waitFor(
    async () => ((await page.locator("#mc-ui .mc-focus-ring").isVisible()) ? true : null),
    "the ring shows",
    8000,
  );
  await pressKey(page, "Escape");
  await waitFor(
    async () => (!(await activeScenes(page)).includes("DeckCheck") ? true : null),
    "left Deck check",
    15_000,
  );
});

test("the screen reads in Spanish", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mc-settings", '{"cardLanguage":"es"}'));
  await open(page);
  await waitForText(page, "Editar mazo", { sceneKey: "DeckCheck" });
});

test("an open aspect tip sits over the filter chips, inside the screen, and a tap on it presses nothing beneath", async ({
  page,
}, info) => {
  test.skip(info.project.name === "phone", "the aspect tiles and their tips are in the wide rail");
  test.setTimeout(120_000);
  // A short screen with the longest tip ('Pool): it must wrap, stay on screen and not run under the chips.
  await page.setViewportSize({ width: 1280, height: 560 });
  await open(page);
  await showCards(page);
  const before = await page.locator(`${panel} mc-card-sections [data-key^="card:"]`).count();
  await page.locator(`${panel} [data-key="aspect-info:pool"]`).first().click();
  const plate = page.locator(`${panel} [data-key="aspect-tip-plate"]`).first();
  await plate.waitFor({ state: "visible", timeout: 10_000 });
  const box = (await plate.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(1280);
  expect(box.y + box.height).toBeLessThanOrEqual(560);
  expect((await findText(page, "Crisis of Infinite Deadpools", "DeckCheck")).length).toBeGreaterThan(0);
  // A tap on the plate (over where the filter chips are) shuts the tip and presses no chip.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await plate.waitFor({ state: "detached", timeout: 10_000 });
  expect(await page.locator(`${panel} mc-card-sections [data-key^="card:"]`).count()).toBe(before);
});
