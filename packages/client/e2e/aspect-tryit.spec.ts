import { expect, test } from "@playwright/test";
import { activeScenes, clickText, installPageHelpers, trackPageErrors, waitFor } from "./helpers.js";

const PAUSE = "PauseOverlay";

async function clickTryIt(page: import("@playwright/test").Page): Promise<void> {
  const rect = await waitFor(
    () =>
      page.evaluate(
        () =>
          (
            window as unknown as { __mcAspectLessonDebug?: { tryItRect: () => unknown } }
          ).__mcAspectLessonDebug?.tryItRect() as {
            x: number;
            y: number;
            width: number;
            height: number;
          } | null,
      ),
    "Try it button",
  );
  await page.waitForTimeout(500);
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
}

/**
 * An aspect lesson's "Try it" still starts a game after the player concedes the last one and comes back (owner
 * report, 2026-09-29): Phaser reuses the scene object, so the lesson's own double-tap guard has to reset per visit.
 */
test("Try it works again after conceding a Try it game", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await installPageHelpers(page);
  await page.goto("/?screen=aspect&aspect=aggression");

  await clickTryIt(page);
  await waitFor(async () => (await activeScenes(page)).includes("Board") || null, "first Try it game");
  await page.waitForTimeout(1500);

  await clickText(page, "Menu", { sceneKey: "Board" });
  await clickText(page, "Concede", { sceneKey: PAUSE });
  await clickText(page, "Yes, concede", { sceneKey: PAUSE });
  await waitFor(async () => !(await activeScenes(page)).includes("Board") || null, "left the board");

  // Back to the same aspect's lesson page, the way How to play opens it.
  await page.evaluate(() => {
    const game = (
      window as unknown as {
        __mcGame: {
          scene: { getScenes: (active: boolean) => { scene: { start: (key: string, data: unknown) => void } }[] };
        };
      }
    ).__mcGame;
    game.scene.getScenes(true)[0]!.scene.start("AspectLesson", { aspect: "aggression", backTo: "howToPlay" });
  });
  await waitFor(async () => (await activeScenes(page)).includes("AspectLesson") || null, "lesson page again");

  await clickTryIt(page);
  await waitFor(async () => (await activeScenes(page)).includes("Board") || null, "second Try it game");
  expect(errors).toEqual([]);
});
