import { expect, test, type Page } from "@playwright/test";
import { settle } from "./helpers.js";
import { clickStop, installWave6Helpers, routeStops, trackErrors, waitForScene } from "./wave6-helpers-a.js";

/**
 * Issue #496: after beating Zola (MC10 p. 12, Hydra Prison not in play), each hero in hero form may flip the "Basic"
 * upgrade they took after Absorbing Man to its "Improved" side. The Aftermath offered every CONDITION card in the
 * first hero's deck, in every hero's column. Each hero now sees only their own recorded upgrade, one at a time.
 * The run is the `seedDesignWon("afterIssue3", { heroForm: true, clearSideSchemes: true })` QA fixture: TRoRS issue 4 (Zola) composed and
 * won with both heroes in hero form, not folded. The design's heroes took Basic Attack (seat 1) and Basic Thwart
 * (seat 2) after Absorbing Man (`dev-fixtures.ts`'s `DESIGN_PICKS`).
 */

const SCENE = "CampaignAftermath";
const BASIC_ATTACK = "04160a";
const BASIC_THWART = "04159a";

const pickKeys = async (page: Page, seat: number): Promise<string[]> =>
  ((await routeStops(page, SCENE))?.stops ?? [])
    .map((stop: { key: string }) => stop.key)
    .filter((key: string) => key.startsWith(`pick:${seat}:`));

test("each hero is offered only their own Basic upgrade to improve", async ({ page, isMobile }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?unlock=all");
  await waitForScene(page, "Title");
  const runId = await page.evaluate(async () => {
    const handle = (
      window as unknown as {
        __mcCampaign: { seedDesignWon(stop: string, options: object): Promise<{ runId: string }> };
      }
    ).__mcCampaign;
    return (await handle.seedDesignWon("afterIssue3", { heroForm: true, clearSideSchemes: true })).runId;
  });
  await page.evaluate((id) => {
    const game = (window as unknown as { __mcGame: any }).__mcGame;
    for (const scene of game.scene.getScenes(true))
      if (scene.sys.settings.key !== "MusicScene") game.scene.stop(scene.sys.settings.key);
    game.scene.start("CampaignAftermath", { runId: id });
  }, runId);
  await waitForScene(page, SCENE, 40_000);
  await expect.poll(async () => (await pickKeys(page, 1)).length, { timeout: 60_000 }).toBeGreaterThan(0);
  await settle(page, { quietMs: 400, maxMs: 3000 });

  expect(await pickKeys(page, 1)).toEqual([`pick:1:${BASIC_ATTACK}`]);
  expect(await pickKeys(page, 2), "seat 2 waits for its own offer").toEqual([]);
  const dir = process.env.E2E_SHOT_DIR;
  const shot = isMobile ? "phone" : "desktop";
  if (dir) await page.screenshot({ path: `${dir}/trors-improved-upgrade-seat1-${shot}.png` });

  await clickStop(page, `pick:1:${BASIC_ATTACK}`, SCENE);
  await clickStop(page, "commit", SCENE);
  await expect.poll(async () => pickKeys(page, 2), { timeout: 30_000 }).toEqual([`pick:2:${BASIC_THWART}`]);
  await settle(page, { quietMs: 400, maxMs: 3000 });
  if (dir) await page.screenshot({ path: `${dir}/trors-improved-upgrade-seat2-${shot}.png` });
  expect(errors).toEqual([]);
});
