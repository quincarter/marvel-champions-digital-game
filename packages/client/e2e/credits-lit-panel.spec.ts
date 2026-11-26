import { expect, test } from "@playwright/test";
import { activeScenes, findText, pressKey, trackPageErrors, waitFor, waitForText } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Art & Credits draws its list as a Lit panel over the canvas (`@mc/ui`'s `mc-credits-list`, `src/dom/dom-region.ts`):
 * its text is found under the Credits scene, it scrolls natively, the keyboard's focus ring is drawn over it, and the
 * panel goes with the screen.
 */

type States = Record<string, () => { focus: string | null; ringShown: boolean }>;

test("Art & Credits is a Lit panel that scrolls, takes focus and leaves with its screen", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openApp(page, "screen=credits", { landing: "Credits" });
  await waitForText(page, "The Watchers", { sceneKey: "Credits" });

  // Native scrolling: the wheel moves the list under the pointer.
  const before = (await findText(page, "The Watchers", "Credits"))[0]!;
  await page.mouse.move(before.x, before.y);
  await page.mouse.wheel(0, 400);
  await waitFor(
    async () => {
      const now = (await findText(page, "The Watchers", "Credits"))[0];
      return now && now.y < before.y - 100 ? true : null;
    },
    "the list scrolled",
    5000,
  );

  // The keyboard walks the entries; the ring is drawn in the DOM, over the panel.
  await pressKey(page, "ArrowDown");
  await waitFor(
    async () => {
      const state = await page.evaluate(() =>
        (window as unknown as { __mcFocusState: States }).__mcFocusState.Credits!(),
      );
      return state.focus?.startsWith("row:") && state.ringShown ? true : null;
    },
    "an entry has focus with the ring shown",
    5000,
  );
  expect(await page.locator("#mc-ui .mc-focus-ring").isVisible()).toBe(true);

  // Back to Extras: the panel and its ring go with the screen.
  await pressKey(page, "Escape");
  await waitFor(async () => ((await activeScenes(page)).includes("Extras") ? true : null), "back on Extras", 10000);
  await expect(page.locator('#mc-ui [data-scene="Credits"]')).toHaveCount(0);
  await expect(page.locator("#mc-ui .mc-focus-ring")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Art & Credits reads in Spanish", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mc-settings", '{"cardLanguage":"es"}'));
  await openApp(page, "screen=credits", { landing: "Credits" });
  await waitForText(page, "Arte y créditos", { sceneKey: "Credits" });
  await waitForText(page, "Este es un proyecto hecho por fans", { sceneKey: "Credits" });
  await waitForText(page, "Música y sonido", { sceneKey: "Credits" });
});
