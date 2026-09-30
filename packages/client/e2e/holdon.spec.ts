import { expect, test } from "@playwright/test";
import { activeScenes, clickFocus, findText, installPageHelpers, trackPageErrors } from "./helpers.js";

/**
 * "Hold on!" (`docs/guided-mode.md` §4 G9b, G11 fix I): the `?screen=board&fixture=holdon-scheme` dev fixture is a
 * live board stopped one End turn away from `hintsFor`'s `schemeFinish` hint, deterministic by construction
 * (`store/dev-hold-on-game.ts`) — no need to play a whole game forward to reach it.
 */
test.describe("Hold on!", () => {
  test("End turn shows Hold on!, and Escape closes it without opening Pause", async ({ page }) => {
    const errors = trackPageErrors(page);
    await installPageHelpers(page);
    await page.goto("/?screen=board&fixture=holdon-scheme");
    await page.waitForFunction(() => !!(window as unknown as { __mcBoardDebug?: unknown }).__mcBoardDebug, undefined, {
      timeout: 15000,
    });
    await page.waitForTimeout(1500);

    await clickFocus(page, "basic:endTurn");
    await page.waitForTimeout(700);

    let scenes = await activeScenes(page);
    expect(scenes, "End turn opens Hold on!").toContain("HoldOnOverlay");
    const headline = await findText(page, "Hold on", "HoldOnOverlay");
    expect(headline.length, "Hold on! headline is visible").toBeGreaterThan(0);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    scenes = await activeScenes(page);
    expect(scenes, "Escape closes Hold on!").not.toContain("HoldOnOverlay");
    expect(scenes, "Escape does not fall through to Pause").not.toContain("Pause");

    expect(errors, `no page errors (${JSON.stringify(errors)})`).toEqual([]);
  });
});
