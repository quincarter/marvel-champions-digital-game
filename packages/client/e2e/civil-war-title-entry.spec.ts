import { expect, test, type Page } from "@playwright/test";
import { activeScenes, settle, trackPageErrors, waitFor } from "./helpers.js";
import { clickStop, hasStop, waitForScene } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * The Title's "Civil War!" entry (owner, 2026-10-13): directly under Campaign once the Civil War box is unlocked, absent
 * (not disabled) before. It opens the builder; the builder's Back returns to where the player came from; hero select's
 * Back returns to the builder.
 */

const stopKeys = (page: Page, scene: string): Promise<string[]> =>
  page.evaluate((s) => {
    const routes = (window as unknown as { __mcFocusRoutes?: Record<string, () => { key: string }[]> }).__mcFocusRoutes;
    return routes?.[s]?.().map((stop) => stop.key) ?? [];
  }, scene);

for (const size of [
  { name: "phone", viewport: { width: 390, height: 844 } },
  { name: "desktop", viewport: { width: 1440, height: 900 } },
] as const) {
  test.describe(`The Title's Civil War! entry at ${size.name} size`, () => {
    test.use({ viewport: size.viewport });

    test("absent on a fresh profile: the menu has no such row, not a disabled one", async ({ page }) => {
      const errors = trackPageErrors(page);
      await openApp(page, "");
      await settle(page);
      const keys = await stopKeys(page, "Title");
      expect(keys).toContain("campaign");
      expect(keys).not.toContain("civil-war");
      expect(await hasStop(page, "civil-war", "Title")).toBe(false);
      expect(errors).toEqual([]);
    });

    test("present right after Campaign once the box is unlocked; it opens the builder and Back returns to the Title", async ({
      page,
    }) => {
      const errors = trackPageErrors(page);
      await openApp(page, "unlock=all");
      await settle(page);
      const keys = await stopKeys(page, "Title");
      expect(keys[keys.indexOf("campaign") + 1]).toBe("civil-war");

      await clickStop(page, "civil-war", "Title");
      await waitForScene(page, "CivilWarBuilder");
      await waitFor(
        async () => ((await page.evaluate(() => "__mcBuilderDebug" in window)) ? true : null),
        "the builder's debug hook",
        10000,
      );
      // No remembered build and no scenario: the first leader as printed, on the side step.
      const view = await page.evaluate(() =>
        (
          window as unknown as {
            __mcBuilderDebug: {
              view: () => { step: number; leaderChoices: { scenarioId: string; selected: boolean }[] };
            };
          }
        ).__mcBuilderDebug.view(),
      );
      expect(view.step).toBe(1);
      expect(view.leaderChoices.find((l) => l.selected)?.scenarioId).toBe("registration-iron-man");

      await clickStop(page, "civil:back", "CivilWarBuilder");
      await waitForScene(page, "Title");
      expect(await hasStop(page, "civil-war", "Title")).toBe(true);
      expect(errors).toEqual([]);
    });

    test("Continue to heroes goes on to hero select, and backing out of it returns to the builder", async ({
      page,
    }) => {
      const errors = trackPageErrors(page);
      await openApp(page, "unlock=all");
      await settle(page);
      await clickStop(page, "civil-war", "Title");
      await waitForScene(page, "CivilWarBuilder");
      await clickStop(page, "civil:start", "CivilWarBuilder");
      await waitForScene(page, "Seats");
      await clickStop(page, "back", "Seats");
      await waitForScene(page, "CivilWarBuilder");
      // Back from the builder still goes to the Title it was entered from.
      await clickStop(page, "civil:back", "CivilWarBuilder");
      await waitFor(
        async () => ((await activeScenes(page)).includes("Title") ? true : null),
        "back on the Title",
        10000,
      );
      expect(errors).toEqual([]);
    });
  });
}
