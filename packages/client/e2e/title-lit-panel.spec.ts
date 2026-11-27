import { expect, test, type Page } from "@playwright/test";
import { activeScenes, pressKey, trackPageErrors, waitFor, waitForText } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * The Title's menu, banners, rank plate, promo panel and footer are a Lit panel over the canvas (`@mc/ui`'s
 * `mc-title-panel`, `src/dom/dom-region.ts`); the picture, the logo and the corner buttons stay Phaser's. The panel is
 * pressed by taps, walked by the keyboard with the DOM focus ring (the same stops as before), reads in Spanish, and
 * goes with the screen.
 */

const panel = (page: Page) => page.locator('#mc-ui [data-scene="Title"] mc-title-panel');

const focusOf = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __mcFocusState: Record<string, () => { focus: string | null; ringShown: boolean }> })
      .__mcFocusState.Title!(),
  );

test("the Title menu is a panel: rows are DOM buttons, a tap opens the screen, and the panel leaves with it", async ({
  page,
}) => {
  const errors = trackPageErrors(page);
  await openApp(page, "");
  await waitForText(page, "Decks & Collection", { sceneKey: "Title" });
  await expect(panel(page)).toBeVisible();
  for (const label of ["New game", "Decks & Collection", "Campaign", "Extras", "Settings"])
    await expect(panel(page).getByText(label, { exact: true }).first()).toBeVisible();
  // The footer says how much of the card pool plays and which build this is.
  await expect(panel(page).getByText(/cards live/)).toBeVisible();

  // Each row is an `mc-button` keyed by its focus stop; a tap (press and release on it) opens its screen.
  await panel(page).getByText("Decks & Collection", { exact: true }).click();
  await waitFor(async () => ((await activeScenes(page)).includes("Decks") ? true : null), "Decks opened", 15000);
  // The Title's panel is gone (or hidden) with its screen: nothing of it is left over Decks.
  const left = await page.evaluate(() => {
    const wrap = document.querySelector<HTMLElement>('#mc-ui [data-scene="Title"]');
    return wrap === null || wrap.style.visibility === "hidden";
  });
  expect(left).toBe(true);
  expect(errors).toEqual([]);
});

test("a release that lifts on a row without pressing it does nothing (the tap rule)", async ({ page }) => {
  await openApp(page, "");
  await waitForText(page, "Extras", { sceneKey: "Title" });
  const before = await activeScenes(page);
  // The lift that ends a swipe: a pointerup with no press on the button, and a press that travelled before lifting.
  const button = panel(page).locator("mc-menu-button").filter({ hasText: "Extras" }).first();
  await button.evaluate((element) => {
    const inner = element.shadowRoot!.querySelector("mc-button")!;
    const at = (type: string, x: number, y: number) =>
      inner.dispatchEvent(
        new PointerEvent(type, { bubbles: true, composed: true, clientX: x, clientY: y, pointerId: 7, button: 0 }),
      );
    at("pointerup", 20, 20);
    at("pointerdown", 20, 20);
    at("pointermove", 20, 90);
    at("pointerup", 20, 92);
  });
  await page.waitForTimeout(400);
  expect(await activeScenes(page)).toEqual(before);
});

test("the keyboard walks the same stops, with the ring drawn in the DOM over the panel, and Enter presses one", async ({
  page,
}) => {
  await openApp(page, "");
  await waitForText(page, "New game", { sceneKey: "Title" });
  const seen: string[] = [];
  for (let i = 0; i < 12; i++) {
    await pressKey(page, "Tab");
    const state = await focusOf(page);
    if (state.focus && !seen.includes(state.focus)) seen.push(state.focus);
    if (state.focus === "decks") break;
  }
  expect(seen).toEqual(expect.arrayContaining(["new-game", "decks"]));
  expect(seen.indexOf("new-game")).toBeLessThan(seen.indexOf("decks"));
  expect((await focusOf(page)).ringShown).toBe(true);
  // The ring frames the focused row: it sits over the Decks & Collection button.
  const ring = await page.locator("#mc-ui .mc-focus-ring").last().boundingBox();
  const row = await panel(page).getByText("Decks & Collection", { exact: true }).first().boundingBox();
  expect(ring).not.toBeNull();
  expect(row).not.toBeNull();
  expect(ring!.x).toBeLessThanOrEqual(row!.x);
  expect(ring!.y).toBeLessThanOrEqual(row!.y);
  expect(ring!.y + ring!.height).toBeGreaterThanOrEqual(row!.y + row!.height);

  await pressKey(page, "Enter");
  await waitFor(async () => ((await activeScenes(page)).includes("Decks") ? true : null), "Enter opened Decks", 15000);
});

test("the rank plate is a control of the panel and opens the Trophy Room", async ({ page }) => {
  await openApp(page, "");
  await waitForText(page, "Trophy Room", { sceneKey: "Title" });
  await panel(page).locator("mc-rank-bar").click();
  await waitFor(
    async () => ((await activeScenes(page)).includes("TrophyRoom") ? true : null),
    "the Trophy Room opened",
    15000,
  );
});

test("the Title reads in Spanish: the menu, the news bar, the rank plate and the footer", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mc-settings", '{"cardLanguage":"es"}'));
  await openApp(page, "");
  await waitForText(page, "Nueva partida", { sceneKey: "Title" });
  for (const text of ["Mazos y colección", "Campaña", "Opciones", "NUEVO", "Saber más", "RANGO 1", "cartas activas"])
    await expect(panel(page).getByText(text).first(), text).toBeVisible();
});
