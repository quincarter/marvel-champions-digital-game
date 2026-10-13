import { expect, test, type Page } from "@playwright/test";
import { clickText, settle, waitFor } from "./helpers.js";
import { clickStop, hasStop, installWave6Helpers, trackErrors, waitForScene } from "./wave6-helpers-a.js";

/**
 * Scenario select keeps its selection on the shelf (click-through finding F4): picking a product chip, or typing in the
 * search, that hides the selected scenario moves the selection to the first scenario still shown, so the side panel and
 * "Choose heroes" never act on a scenario the shelf is not showing. Chips and search behave the same.
 */

const selectedId = (page: Page): Promise<string> =>
  page.evaluate(() =>
    (
      window as unknown as { __mcScenarioSelectDebug: { selectedId: () => string } }
    ).__mcScenarioSelectDebug.selectedId(),
  );

const shelfScenarioIds = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    (window as unknown as { __mcScenarioSelectDebug: { stops: () => { key: string }[] } }).__mcScenarioSelectDebug
      .stops()
      .map((stop) => stop.key)
      .filter((key) => key.startsWith("scenario:") && key !== "scenario:civil-war-builder")
      .map((key) => key.slice("scenario:".length)),
  );

async function startNewGameNoGuide(page: Page): Promise<void> {
  await waitForScene(page, "Title", 30000);
  await settle(page);
  await clickText(page, "NEW GAME", { sceneKey: "Title" });
  await waitForScene(page, "GuideChooser");
  await settle(page);
  await clickText(page, "No guide", { sceneKey: "GuideChooser" });
  await settle(page);
  await clickText(page, "SUIT UP", { sceneKey: "GuideChooser" });
  await waitForScene(page, "ScenarioSelect");
  await waitFor(async () => (await hasStop(page, "next", "ScenarioSelect")) || null, "scenario list", 15000);
}

async function open(page: Page, viewport: { width: number; height: number }): Promise<string[]> {
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.setViewportSize(viewport);
  await page.goto("/?unlock=all");
  await startNewGameNoGuide(page);
  return errors;
}

test("a chip that hides the selected scenario selects one the shelf shows (desktop)", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await open(page, { width: 1440, height: 900 });

  await clickStop(page, "scenario:rhino", "ScenarioSelect");
  await settle(page);
  expect(await selectedId(page)).toBe("rhino");

  await clickStop(page, "scenario-chip:product:cw", "ScenarioSelect");
  await settle(page);
  const shown = await shelfScenarioIds(page);
  expect(shown.length).toBeGreaterThan(0);
  expect(shown).not.toContain("rhino");
  expect(await selectedId(page)).toBe(shown[0]);
  await shot(page, "wave10-fix-f4-desktop");

  // The same chip again clears the filter; the selection stays on what is still shown.
  await clickStop(page, "scenario-chip:product:cw", "ScenarioSelect");
  await settle(page);
  expect(await selectedId(page)).toBe(shown[0]);
  expect(errors).toEqual([]);
});

test("a search that hides the selected scenario does the same (phone)", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await open(page, { width: 390, height: 844 });

  await clickStop(page, "scenario:rhino", "ScenarioSelect");
  await settle(page);
  expect(await selectedId(page)).toBe("rhino");

  await clickStop(page, "scenario-search-toggle", "ScenarioSelect");
  await settle(page);
  await clickStop(page, "scenario-search", "ScenarioSelect");
  await page.keyboard.type("captain america");
  await settle(page);
  const shown = await shelfScenarioIds(page);
  expect(shown).toEqual(["resistance-captain-america"]);
  expect(await selectedId(page)).toBe("resistance-captain-america");
  await shot(page, "wave10-fix-f4-phone");
  expect(errors).toEqual([]);
});

async function shot(page: Page, name: string): Promise<void> {
  const dir = process.env.E2E_SHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}
