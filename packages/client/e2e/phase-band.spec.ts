import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickFocus, clickText, findText, guideStepId, installPageHelpers, waitFor } from "./helpers.js";

/** The "ROUND N · PLAYER PHASE" band, if it's on screen right now (a band that slid out sits off to the right). */
async function bandOnScreen(page: Page): Promise<boolean> {
  const width = page.viewportSize()!.width;
  const matches = await findText(page, "player phase", "Board");
  return matches.some((m) => m.x > 0 && m.x < width);
}

/**
 * Every round after the first, the ROUND N · PLAYER PHASE band used to play behind the villain phase walkthrough,
 * which stays up into the next player phase until the player presses Continue (owner report, 2026-09-29). It now
 * waits for the walkthrough to close. Driven with the Justice Try it game, whose round-1 villain phase has no
 * decision in it, so ending the turn also runs straight into round 2 in one batch.
 */
test("the round 2 player phase band plays after the villain phase walkthrough, not behind it", async ({ page }) => {
  test.setTimeout(120_000);
  await installPageHelpers(page);
  await page.goto("/?screen=aspect&aspect=justice");
  const tryIt = await waitFor(
    () =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __mcAspectLessonDebug?: {
                tryItRect: () => { x: number; y: number; width: number; height: number } | null;
              };
            }
          ).__mcAspectLessonDebug?.tryItRect() ?? null,
      ),
    "Try it button",
  );
  await page.waitForTimeout(500);
  await page.mouse.click(tryIt.x + tryIt.width / 2, tryIt.y + tryIt.height / 2);
  await waitFor(async () => (await guideStepId(page)) === "intro" || null, "Justice intro");
  await page.waitForTimeout(3500); // round 1's own band has played out

  await clickFocus(page, "basic:endTurn");
  await page.waitForTimeout(500);
  try {
    await clickText(page, "End turn", { sceneKey: "EndTurnConfirmOverlay", timeoutMs: 1500 });
  } catch {
    // No end-turn confirm this run.
  }

  let continueButton: { x: number; y: number } | null = null;
  for (let i = 0; i < 60 && !continueButton; i++) {
    const scenes = await activeScenes(page);
    if (scenes.includes("ChoiceOverlay")) {
      try {
        await clickText(page, "DECLINE", { sceneKey: "ChoiceOverlay", timeoutMs: 800 });
      } catch {
        await clickText(page, "CONFIRM", { sceneKey: "ChoiceOverlay", timeoutMs: 800 });
      }
      await page.waitForTimeout(400);
      continue;
    }
    if (scenes.includes("VillainPhaseOverlay")) {
      const found = await findText(page, "Continue", "VillainPhaseOverlay");
      if (found.length > 0) continueButton = found[0]!;
    }
    if (!continueButton) await page.waitForTimeout(300);
  }
  expect(continueButton, "the walkthrough reached its Continue with round 2 begun").not.toBeNull();
  expect(
    await page.evaluate(async () => {
      const mod = (await import("/src/session.ts")) as unknown as {
        appSession: () => { store: { state: { game: { round: number; step: { phase: string } } } } };
      };
      const { game } = mod.appSession().store.state;
      return `${game.round}:${game.step.phase}`;
    }),
  ).toBe("2:player");

  // Held while the walkthrough covers the table...
  expect(await bandOnScreen(page), "band held behind the walkthrough").toBe(false);
  await page.mouse.click(continueButton!.x, continueButton!.y);
  // ...then plays once it's gone.
  await waitFor(async () => (await bandOnScreen(page)) || null, "ROUND 2 · PLAYER PHASE band on screen", 2000);
});
