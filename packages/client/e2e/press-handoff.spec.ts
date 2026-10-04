import { expect, test } from "@playwright/test";
import { activeScenes, clickText, findText, installPageHelpers, waitFor, waitForText } from "./helpers.js";

/**
 * A screen that redraws between a button's pointer-down and its pointer-up (How to win redraws when a card scan
 * arrives) used to lose the tap: the rebuilt button never saw the release (`ui/widgets.ts`, `McButton`). Raw
 * pointer events on purpose, not the verified `pressAt`: this test is about the first press landing.
 */
test("a tap that straddles a redraw still presses the rebuilt button", async ({ page }) => {
  test.setTimeout(120_000);
  await installPageHelpers(page);
  await page.goto("/");
  await waitFor(async () => ((await activeScenes(page)).includes("Title") ? true : null), "boot lands on Title", 20000);
  await clickText(page, "NEW GAME", { until: async () => (await findText(page, "Learn as you play")).length > 0 });
  await clickText(page, "Learn as you play", { until: async () => (await findText(page, "Suit up")).length > 0 });
  await clickText(page, "Suit up", { until: async () => (await findText(page, "Start the fight")).length > 0 });
  const button = (await waitForText(page, "Start the fight"))[0]!;
  await page.mouse.move(button.x, button.y);
  await page.mouse.down();
  // A redraw while the pointer is down: the scale manager's resize, which every screen rebuilds on.
  await page.evaluate(() => {
    const scale = (
      window as unknown as {
        __mcGame: {
          scale: {
            emit: (e: string, ...a: unknown[]) => void;
            gameSize: unknown;
            baseSize: unknown;
            displaySize: unknown;
            width: number;
            height: number;
          };
        };
      }
    ).__mcGame.scale;
    scale.emit("resize", scale.gameSize, scale.baseSize, scale.displaySize, scale.width, scale.height);
  });
  await page.mouse.up();
  await waitFor(
    async () => ((await activeScenes(page)).includes("Board") ? true : null),
    "the press reached the Board",
  );
  expect(await activeScenes(page)).toContain("Board");
});
