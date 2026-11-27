import { expect, test, type Page } from "@playwright/test";
import { activeScenes, findText, pressKey, settle, trackPageErrors, waitFor, waitForText } from "./helpers.js";
import { routeStops } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Extras and its viewer draw as Lit panels over the canvas (`mc-sheet`, `src/dom/sheet-builder.ts`): the top bar, doors,
 * tab rail and the shelf of tiles are found under their scene, a locked tile's picture is a gray ghost, the keyboard walks
 * the same stops with the ring drawn in the DOM, the Music tab's Phaser player is pressable through its hole, a tile opens
 * the viewer, and on a phone the lift that ends a swipe over the shelf presses no tile.
 */

type FocusStates = Record<string, () => { focus: string | null; ringShown: boolean }>;

const focusOf = (page: Page, scene: string): Promise<{ focus: string | null; ringShown: boolean }> =>
  page.evaluate((key) => (window as unknown as { __mcFocusState: FocusStates }).__mcFocusState[key]!(), scene);

const panel = (scene: string) => `#mc-ui [data-scene="${scene}"]`;

async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const steps = 10;
  const at = (i: number) => ({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= steps; i++)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...at(i), id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

test("Extras is a Lit panel: tabs, tiles, the keyboard walks the stops and a tab press switches the shelf", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openApp(page, "screen=extras&unlock=all", { landing: "Extras" });
  await waitForText(page, "EXTRAS", { sceneKey: "Extras" });
  expect(await findText(page, "OPEN", "Extras"), "the summary is in the top bar").not.toHaveLength(0);
  await expect(page.locator(`${panel("Extras")} [data-key^="tab:"]`)).toHaveCount(8);
  await expect(page.locator(`${panel("Extras")} [data-key="shelf"]`)).toHaveCount(1);
  await expect(page.locator(`${panel("Extras")} [data-key^="tile:"]`).first()).toHaveCount(1);
  await expect(page.locator(`${panel("Extras")} [data-key="tab:stories"]`)).toHaveAttribute("selected", "");

  // The keyboard walks Back, the two doors, then the tabs.
  await pressKey(page, "Tab");
  await waitFor(async () => ((await focusOf(page, "Extras")).focus ? true : null), "something has focus", 5000);
  expect((await focusOf(page, "Extras")).focus).toBe("back");
  expect(await page.locator("#mc-ui .mc-focus-ring").isVisible()).toBe(true);
  for (let step = 0; step < 6 && (await focusOf(page, "Extras")).focus !== "tab:heroes"; step++) {
    await pressKey(page, "Tab");
    await page.waitForTimeout(80);
  }
  expect((await focusOf(page, "Extras")).focus).toBe("tab:heroes");
  await pressKey(page, "Enter");
  await expect(page.locator(`${panel("Extras")} [data-key="tab:heroes"]`)).toHaveAttribute("selected", "");
  // A hero's tile is a stop, with its picture in the panel.
  await expect(page.locator(`${panel("Extras")} [data-key^="tile:"] >> nth=0`)).toHaveCount(1);
  await expect(page.locator(`${panel("Extras")} [data-key^="thumb:"] img`).first()).toHaveCount(1);

  // Escape leaves for Title; the panel and its ring go with the screen.
  await pressKey(page, "Escape");
  await waitFor(async () => ((await activeScenes(page)).includes("Title") ? true : null), "back on Title", 10_000);
  await expect(page.locator(panel("Extras"))).toHaveCount(0);
  await expect(page.locator("#mc-ui .mc-focus-ring")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a locked tile says LOCKED over a gray ghost of its picture and opens nothing; an open one opens the viewer", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openApp(page, "screen=extras&tab=heroes", { landing: "Extras" });
  await waitForText(page, "LOCKED", { sceneKey: "Extras" });
  const ghost = page.locator(`${panel("Extras")} [data-key^="thumb:"] img`).first();
  await expect(ghost).toHaveCount(1);
  expect(await ghost.evaluate((img) => getComputedStyle(img).filter)).toContain("grayscale");
  const tile = page.locator(`${panel("Extras")} [data-key^="tile:"]`).first();
  await tile.click();
  await page.waitForTimeout(600);
  expect(await activeScenes(page)).not.toContain("ExtrasViewerOverlay");

  await openApp(page, "screen=extras&tab=heroes&unlock=all", { landing: "Extras" });
  await waitForText(page, "VIEW", { sceneKey: "Extras" });
  await page
    .locator(`${panel("Extras")} [data-key^="tile:"]`)
    .first()
    .click();
  await waitFor(
    async () => ((await activeScenes(page)).includes("ExtrasViewerOverlay") ? true : null),
    "the viewer opens",
    10_000,
  );
  const viewer = panel("ExtrasViewerOverlay");
  await expect(page.locator(`${viewer} [data-key="slide"] img`)).toHaveCount(1);
  await expect(page.locator(`${viewer} [data-key="close"]`)).toHaveCount(1);
  // Escape closes the viewer and the shelf is still up.
  await pressKey(page, "Escape");
  await waitFor(
    async () => (!(await activeScenes(page)).includes("ExtrasViewerOverlay") ? true : null),
    "the viewer closes",
    10_000,
  );
  expect(await activeScenes(page)).toContain("Extras");
});

test("the Music tab's player is the Phaser widget seen through its hole: Shuffle is pressable, and a song row plays", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openApp(page, "screen=extras&tab=music&unlock=all", { landing: "Extras" });
  await expect(page.locator(`${panel("Extras")} [data-key="tab:music"]`)).toHaveAttribute("selected", "");
  const stops = await waitFor(
    async () => {
      const found = (await routeStops(page, "Extras"))?.stops ?? [];
      return found.some((stop) => stop.key === "player:shuffle") ? found : null;
    },
    "the player's stops are up",
    10_000,
  );
  const shuffle = stops.find((stop) => stop.key === "player:shuffle")!.rect;
  await page.mouse.click(shuffle.x + shuffle.width / 2, shuffle.y + shuffle.height / 2);
  await waitFor(
    async () =>
      (await page.evaluate(() => JSON.parse(localStorage.getItem("mc-settings") ?? "{}").musicShuffle)) === true
        ? true
        : null,
    "Shuffle turned on through the hole",
    10_000,
  );
  // A song row in the panel plays it: its row turns to the playing look ("Now playing").
  await page
    .locator(`${panel("Extras")} [data-key^="tile:"]`)
    .nth(1)
    .click();
  await waitForText(page, "Now playing", { sceneKey: "Extras" });
});

test("Extras reads in Spanish", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mc-settings", '{"cardLanguage":"es"}'));
  await openApp(page, "screen=extras&unlock=all", { landing: "Extras" });
  await waitForText(page, "ABIERTOS", { sceneKey: "Extras" });
  await expect(page.locator(panel("Extras")).getByText("Créditos")).toHaveCount(1);
  await expect(page.locator(panel("Extras")).getByText("Historias").first()).toHaveCount(1);
  await openApp(page, "screen=extras&tab=heroes", { landing: "Extras" });
  await waitForText(page, "BLOQUEADO", { sceneKey: "Extras" });
  await expect(page.locator(panel("Extras")).getByText("Termina una partida como").first()).toHaveCount(1);
});

test("on a phone, the lift that ends a swipe over the shelf presses no tile", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "a touch swipe");
  test.setTimeout(120_000);
  await openApp(page, "screen=extras&unlock=all", { landing: "Extras" });
  await waitForText(page, "EXTRAS", { sceneKey: "Extras" });
  await settle(page);
  const tiles = page.locator(`${panel("Extras")} [data-key^="tile:"]`);
  const first = (await tiles.nth(2).boundingBox())!;
  const view = page.viewportSize()!;
  // From a tile up the shelf, lifted over another: a scroll, and nothing opens.
  await swipe(
    page,
    { x: first.x + first.width / 2, y: Math.min(view.height - 60, first.y + first.height / 2) },
    { x: first.x + first.width / 2, y: first.y - 140 },
  );
  await page.waitForTimeout(700);
  expect(await activeScenes(page)).toContain("Extras");
  expect(await activeScenes(page)).not.toContain("CampaignOpener");
  expect(await activeScenes(page)).not.toContain("ExtrasViewerOverlay");
  await settle(page);
});
