import { expect, test } from "@playwright/test";
import {
  activeScenes,
  clickFocus,
  clickText,
  guideStepId,
  guideStopped,
  installPageHelpers,
  startTutorialFromTitle,
  trackPageErrors,
  waitFor,
} from "./helpers.js";

/**
 * §3.10 "never locked in" (`docs/guided-mode.md`): every guide surface always offers "Skip this step" and Escape,
 * and Pause always offers "Stop tutorial" whenever a guided run is active — regressions here would trap a player
 * inside the tutorial with no way out, so this gets its own spec rather than folding into the happy-path run.
 */
test("Skip this step, Escape and Stop tutorial all release the player, and the game stays playable", async ({
  page,
}) => {
  // A full guided run clicks through many real steps; on a software-rendered CI runner that takes minutes, not seconds.
  test.setTimeout(240_000);
  const errors = trackPageErrors(page);
  await installPageHelpers(page);
  await page.goto("/");
  await startTutorialFromTitle(page);

  // "Skip this step" advances past the current lesson step without completing it.
  await waitFor(async () => (await guideStepId(page)) === "play-black-cat" || null, "lesson2 play-black-cat step");
  const beforeSkip = await guideStepId(page);
  await clickText(page, "Skip this step");
  await page.waitForTimeout(400);
  const afterSkip = await guideStepId(page);
  expect(afterSkip, `Skip this step advances past "${beforeSkip}"`).not.toBe(beforeSkip);

  // Escape releases the current gate the same way (guide/guide-controller.ts: onGateReleased -> skip()).
  await waitFor(
    async () => {
      const step = await guideStepId(page);
      return step && step !== afterSkip ? step : null;
    },
    "a fresh guide step is showing",
    8000,
  ).catch(() => {
    // If the run is already past scripted steps (e.g. only the waiting/complete state remains), Escape still must
    // not throw or lock anything — the assertions below just have nothing to advance.
  });
  const beforeEscape = await guideStepId(page);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const afterEscape = await guideStepId(page);
  if (beforeEscape !== null) {
    expect(afterEscape, `Escape advances past "${beforeEscape}"`).not.toBe(beforeEscape);
  }

  // Stop tutorial (from Pause) ends guidance outright, and the game is still playable underneath it.
  await clickText(page, "MENU");
  await page.waitForTimeout(400);
  let scenes = await activeScenes(page);
  expect(scenes, "MENU opens Pause").toContain("PauseOverlay");
  await clickText(page, "Stop tutorial");
  await page.waitForTimeout(400);
  await clickText(page, "Resume");
  await page.waitForTimeout(400);
  scenes = await activeScenes(page);
  expect(scenes, "Pause closes after Resume").not.toContain("PauseOverlay");
  expect(await guideStopped(page), "guide reports stopped").toBe(true);

  // The board is still a real, playable game: the end-turn control still has a live focus rect.
  const endTurnRect = await clickFocus(page, "basic:endTurn").catch(() => null);
  expect(endTurnRect, "End turn is still a live, clickable control after Stop tutorial").not.toBeNull();

  expect(errors, `no page errors (${JSON.stringify(errors)})`).toEqual([]);
});
