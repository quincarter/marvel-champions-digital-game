import { expect, test, type Page } from "@playwright/test";
import { activeScenes, pressKey, settle, trackPageErrors, waitFor } from "./helpers.js";
import { installWave6Helpers, routeStops } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * The deck builder's two pop-up sheets are Lit panels over the canvas (`scenes/search-help-sheet.ts`,
 * `scenes/pool-pick-sheet.ts`): the "?" search cheat sheet (Use puts an example in the search, Copy copies it) and the
 * pack and wave picker. Their lists scroll natively, their buttons are taps, and the keyboard walks the same stops with
 * the DOM focus ring (Escape closes). The builder itself is still drawn in Phaser.
 */

const sheetOf = (page: Page, scene: string) => page.locator(`#mc-ui [data-scene="${scene}"] mc-sheet`);

const focusOf = (page: Page, scene: string) =>
  page.evaluate(
    (key) =>
      (window as unknown as { __mcFocusState: Record<string, () => { focus: string | null; ringShown: boolean }> })
        .__mcFocusState[key]!(),
    scene,
  );

async function openBuilder(page: Page): Promise<void> {
  await installWave6Helpers(page);
  await openApp(page, "screen=deck-builder", { landing: "DeckBuilder" });
  await page.waitForTimeout(800);
}

async function pressBuilderStop(page: Page, key: string): Promise<void> {
  const stop = await waitFor(
    async () => (await routeStops(page, "DeckBuilder"))?.stops.find((s) => s.key === key) ?? null,
    `the ${key} control`,
    15_000,
  );
  await page.mouse.click(stop.rect.x + stop.rect.width / 2, stop.rect.y + stop.rect.height / 2);
}

test("the ? cheat sheet is a panel over the builder: rows scroll, Use fills the search, Escape closes", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "the phone folds the search behind its filters");
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openBuilder(page);
  await pressBuilderStop(page, "filter-help");
  const help = sheetOf(page, "SearchHelpSheet");
  await expect(help).toBeVisible();
  await expect(help.locator('[data-key="list-help"], [data-key="help-list"]').first()).toBeVisible();
  // The rows have Use and Copy buttons in the list; the first example is the cost term.
  await expect(help.locator('[data-key="use:6"]')).toBeVisible();
  await expect(help.locator('[data-key="copy:6"]')).toBeVisible();
  // The keyboard walks the stops with the DOM ring (the first one is the first Use).
  await pressKey(page, "Tab");
  expect((await focusOf(page, "SearchHelpSheet")).focus).toBe("use:6");
  expect((await focusOf(page, "SearchHelpSheet")).ringShown).toBe(true);
  // Escape closes the sheet and leaves the builder as it was.
  await pressKey(page, "Escape");
  await waitFor(
    async () => (!(await activeScenes(page)).includes("SearchHelpSheet") ? true : null),
    "the sheet closes",
  );
  await expect(help).toHaveCount(0);
  // Use puts the example in the search and closes the sheet.
  await pressBuilderStop(page, "filter-help");
  await expect(help.locator('[data-key="use:6"]')).toBeVisible();
  await help.locator('[data-key="use:6"]').click();
  await waitFor(
    async () => (!(await activeScenes(page)).includes("SearchHelpSheet") ? true : null),
    "the sheet closes",
  );
  expect(await page.locator("input").evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value))).toContain(
    "o:2",
  );
  await settle(page);
  expect(errors).toEqual([]);
});

test("the pack picker is a panel: rows toggle, All clears, Done closes", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the pack name sits in the wide layout's pool column");
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openBuilder(page);
  await pressBuilderStop(page, "pack:name");
  const picker = sheetOf(page, "PoolPickSheet");
  await expect(picker).toBeVisible();
  await expect(picker.locator('[data-key="pick:all"]')).toHaveAttribute("selected", "");
  const first = picker.locator('mc-button[data-key^="pick:"]:not([data-key="pick:all"])').first();
  await first.click();
  await expect(first).toHaveAttribute("selected", "");
  await expect(picker.locator('[data-key="pick:all"]')).not.toHaveAttribute("selected", "");
  await picker.locator('[data-key="pick:all"]').click();
  await expect(picker.locator('[data-key="pick:all"]')).toHaveAttribute("selected", "");
  await picker.locator('[data-key="done"]').click();
  await waitFor(async () => (!(await activeScenes(page)).includes("PoolPickSheet") ? true : null), "the picker closes");
  expect(errors).toEqual([]);
});
