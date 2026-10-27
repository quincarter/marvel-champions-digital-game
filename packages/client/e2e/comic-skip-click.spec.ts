import { expect, test, type Page } from "@playwright/test";
import { activeScenes, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, routeStops, trackErrors, waitForScene } from "./wave6-helpers-a.js";

/**
 * Issue #452: clicking SKIP on a comic turned one page instead of leaving it. The comic redraws itself while its
 * camera moves, and a click whose press and release straddled a redraw was handed to the page's tap-to-turn zone (it
 * covers the header too), so SKIP read as NEXT. Esc always worked. Each test presses SKIP, redraws the screen under
 * the held button, releases, and expects the comic gone.
 */

async function pressSkipAcrossRedraw(page: Page, scene: string): Promise<void> {
  const skip = await waitFor(
    async () => (await routeStops(page, scene))?.stops.find((s) => s.key === "skip") ?? null,
    `SKIP on ${scene}`,
    15000,
  );
  await settle(page, { quietMs: 300, maxMs: 2000 });
  await page.mouse.move(skip.rect.x + skip.rect.width / 2, skip.rect.y + skip.rect.height / 2);
  await page.mouse.down();
  // The screen draws again while the button is held, as it does every frame of a panel-to-panel move.
  const redrawn = await page.evaluate((key) => {
    interface Obj {
      active: boolean;
    }
    const game = (
      window as unknown as {
        __mcGame?: {
          scale: { gameSize: unknown; baseSize: unknown; displaySize: unknown; width: number; height: number } & {
            emit: (...args: unknown[]) => void;
          };
          scene: { getScene: (key: string) => { children: { list: Obj[] } } };
        };
      }
    ).__mcGame!;
    const before = [...game.scene.getScene(key).children.list];
    const { scale } = game;
    scale.emit("resize", scale.gameSize, scale.baseSize, scale.displaySize, scale.width, scale.height);
    return before.some((o) => !o.active);
  }, scene);
  expect(redrawn, "the screen was drawn again under the held button").toBe(true);
  await page.mouse.up();
}

async function leaves(page: Page, scene: string): Promise<void> {
  await waitFor(async () => (!(await activeScenes(page)).includes(scene) ? true : null), `${scene} closed`, 10000);
}

test("SKIP on a campaign issue's comic leaves it, even when the page redraws mid-click", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "a mouse click at one size covers it");
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=campaign-opener&campaign=fne&node=art-museum-heist");
  await waitForScene(page, "CampaignOpener", 30000);
  await pressSkipAcrossRedraw(page, "CampaignOpener");
  await leaves(page, "CampaignOpener");
  expect(errors).toEqual([]);
});

test("SKIP on a scenario's intro comic leaves it, even when the page redraws mid-click", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "a mouse click at one size covers it");
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?unlock=all&screen=scenario-intro&seed=7");
  await waitForScene(page, "ScenarioIntro", 40000);
  await pressSkipAcrossRedraw(page, "ScenarioIntro");
  await leaves(page, "ScenarioIntro");
  expect(errors).toEqual([]);
});
