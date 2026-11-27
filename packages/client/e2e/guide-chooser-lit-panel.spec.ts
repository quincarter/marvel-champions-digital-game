import { expect, test, type Page } from "@playwright/test";
import { activeScenes, findText, pressKey, trackPageErrors, waitFor, waitForText } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * The first-run chooser ("New to the fight?") draws as a Lit panel over the canvas (`mc-sheet`,
 * `src/dom/sheet-builder.ts`): its text is found under its scene, the title picture is the small display copy (a WebP,
 * not the original), a card press selects, the keyboard walks the same stops with the ring drawn in the DOM, Escape
 * leaves for Title and Enter on Suit up goes on.
 */

type FocusStates = Record<string, () => { focus: string | null; ringShown: boolean }>;

const focusOf = (page: Page, scene: string): Promise<{ focus: string | null; ringShown: boolean }> =>
  page.evaluate((key) => (window as unknown as { __mcFocusState: FocusStates }).__mcFocusState[key]!(), scene);

const panel = `#mc-ui [data-scene="GuideChooser"]`;

test("the chooser is a Lit panel: three cards, a small picture, the keyboard picks one and Suit up goes on", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openApp(page, "screen=chooser", { landing: "GuideChooser" });
  await waitForText(page, "NEW TO THE FIGHT?", { sceneKey: "GuideChooser" });
  await waitForText(page, "Learn as you play", { sceneKey: "GuideChooser" });
  expect(await findText(page, "Hints only", "GuideChooser")).not.toHaveLength(0);
  expect(await findText(page, "No guide", "GuideChooser")).not.toHaveLength(0);
  expect(await findText(page, "RECOMMENDED", "GuideChooser")).not.toHaveLength(0);

  // The picture is the panel-size WebP copy the build makes, loaded lazily, never the original file.
  const picture = page.locator(`${panel} img`).first();
  await expect(picture).toHaveCount(1);
  await expect(picture).toHaveAttribute("loading", "lazy");
  expect(await picture.getAttribute("src")).toMatch(/(@art-copy\/display\/|\.webp)/);

  // The first arrow press takes the first card, Down walks to the next and Enter picks it.
  await pressKey(page, "ArrowDown");
  await waitFor(async () => ((await focusOf(page, "GuideChooser")).focus ? true : null), "something has focus", 5000);
  expect((await focusOf(page, "GuideChooser")).ringShown).toBe(true);
  expect(await page.locator("#mc-ui .mc-focus-ring").isVisible()).toBe(true);
  for (let step = 0; step < 6 && (await focusOf(page, "GuideChooser")).focus !== "option:hints"; step++) {
    await pressKey(page, "ArrowDown");
    await page.waitForTimeout(80);
  }
  expect((await focusOf(page, "GuideChooser")).focus).toBe("option:hints");
  await pressKey(page, "Enter");
  // The picked card's frame is the red one: the card box carries a thicker outline than the other two.
  const stroke = (value: string) =>
    page.locator(`${panel} [data-key="card:${value}"]`).evaluate((el) => getComputedStyle(el).outlineWidth);
  await waitFor(async () => ((await stroke("hints")) === "3px" ? true : null), "Hints only is picked", 5000);
  expect(await stroke("full")).toBe("1.5px");

  // Suit up with Hints only goes on to Scenario select.
  await page.locator(`${panel} [data-key="suit-up"]`).click();
  await waitFor(
    async () => ((await activeScenes(page)).includes("ScenarioSelect") ? true : null),
    "on scenario select",
    15_000,
  );
  await expect(page.locator(panel)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Escape on the chooser goes back to Title, and Learn as you play with Suit up opens How to win", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openApp(page, "screen=chooser", { landing: "GuideChooser" });
  await waitForText(page, "Learn as you play", { sceneKey: "GuideChooser" });
  await pressKey(page, "Escape");
  await waitFor(async () => ((await activeScenes(page)).includes("Title") ? true : null), "back on Title", 10_000);
  await expect(page.locator(panel)).toHaveCount(0);

  await openApp(page, "screen=chooser", { landing: "GuideChooser" });
  await waitForText(page, "Suit up", { sceneKey: "GuideChooser" });
  await page.locator(`${panel} [data-key="suit-up"]`).click();
  await waitFor(
    async () => ((await activeScenes(page)).includes("HowToWin") ? true : null),
    "How to win opens",
    15_000,
  );
});

test("the chooser reads in Spanish", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mc-settings", '{"cardLanguage":"es"}'));
  await openApp(page, "screen=chooser", { landing: "GuideChooser" });
  await waitForText(page, "¿NUEVO EN LA LUCHA?", { sceneKey: "GuideChooser" });
  await waitForText(page, "Aprende jugando", { sceneKey: "GuideChooser" });
  await waitForText(page, "RECOMENDADO", { sceneKey: "GuideChooser" });
  await expect(page.locator(panel).getByText("A la acción")).toHaveCount(1);
});
