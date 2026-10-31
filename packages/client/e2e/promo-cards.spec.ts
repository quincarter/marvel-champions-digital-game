import { expect, test, type Page } from "@playwright/test";
import { isSceneUp, settle, trackPageErrors, waitFor } from "./helpers.js";
import { routeStops, waitForScene } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Promo cards (issue #192): an earned promo is picked in Extras ▸ Promos, the pick is saved, and the table draws the
 * promo in place of the normal scan.
 */

const VIEWER = "ExtrasViewerOverlay";

const storedPromos = (page: Page): Promise<readonly string[] | undefined> =>
  page.evaluate(() => {
    const raw = localStorage.getItem("mc-settings");
    return raw ? (JSON.parse(raw) as { promoArt?: readonly string[] }).promoArt : undefined;
  });

async function pressStop(page: Page, scene: string, key: string): Promise<void> {
  const stop = await waitFor(
    async () => (await routeStops(page, scene))?.stops.find((s) => s.key === key)?.rect ?? null,
    `${scene} draws ${key}`,
    10000,
  );
  await page.mouse.click(stop.x + stop.width / 2, stop.y + stop.height / 2);
  await settle(page);
}

test("an earned promo is picked, stays picked, and is drawn on the table", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openApp(page, "screen=extras&tab=promos&unlock=all", { landing: "Extras" });
  await settle(page);

  await pressStop(page, "Extras", "tile:promo:spider-man");
  await waitForScene(page, VIEWER, 10000);
  await pressStop(page, VIEWER, "promo");
  expect(await storedPromos(page)).toEqual(["spider-man"]);

  await pressStop(page, VIEWER, "close");
  const drawn = page.waitForRequest(/\/card-art\/promos\/01001[ab]-1\.webp/, { timeout: 60000 });
  await openApp(page, "screen=board&unlock=all", { landing: "Board" });
  await drawn;
  expect(await storedPromos(page)).toEqual(["spider-man"]);
  expect(errors).toEqual([]);
});

test("a promo not earned yet is not drawn, even if a save names it", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mc-settings", JSON.stringify({ promoArt: ["spider-man"] })));
  const asked: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/card-art/promos/")) asked.push(request.url());
  });
  await openApp(page, "screen=board", { landing: "Board" });
  await settle(page);
  expect(asked).toEqual([]);
});

test("a locked promo tile opens the card hover on a mouse, and no viewer", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the hover is a desktop mouse's");
  await openApp(page, "screen=extras&tab=promos", { landing: "Extras" });
  await settle(page);
  const tile = await waitFor(
    async () => (await routeStops(page, "Extras"))?.stops.find((s) => s.key === "tile:promo:spider-man")?.rect ?? null,
    "Extras draws the Spider-Man tile",
    10000,
  );
  const hovered = page.waitForRequest(/\/card-art\/promos\/01001a-1\.webp/, { timeout: 15000 });
  await page.mouse.move(tile.x + tile.width / 2, tile.y + tile.height / 2);
  await hovered;
  await page.mouse.click(tile.x + tile.width / 2, tile.y + tile.height / 2);
  await settle(page);
  expect(await isSceneUp(page, VIEWER)).toBe(false);
});

test("the hero select art button steps Game, Card and Promo art, and the choice is saved", async ({ page }) => {
  const stored = (): Promise<string | undefined> =>
    page.evaluate(() => {
      const raw = localStorage.getItem("mc-settings");
      return raw ? (JSON.parse(raw) as { heroArt?: string }).heroArt : undefined;
    });
  await openApp(page, "screen=seats&unlock=all", { landing: "Seats" });
  await settle(page);
  await pressStop(page, "Seats", "hero-art");
  expect(await stored()).toBe("card");
  const promo = page.waitForRequest(/\/card-art\/promos\/01001a-1\.webp/, { timeout: 15000 });
  await pressStop(page, "Seats", "hero-art");
  expect(await stored()).toBe("promo");
  await promo;
  await pressStop(page, "Seats", "hero-art");
  expect(await stored()).toBe("game");
});
