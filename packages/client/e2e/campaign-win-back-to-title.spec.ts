import { expect, test } from "@playwright/test";
import { clickText, settle } from "./helpers.js";
import { installWave6Helpers, openSaga, screens, waitForScene } from "./wave6-helpers-a.js";

/**
 * Issue #265: after a won campaign game, "Back to title" on Game over left the result unfolded, and continuing the
 * campaign offered the same mission again. Continuing now picks the finished game back up and opens its Aftermath.
 * The run is the `seedDesignWon()` QA fixture: MC10 issue 3 composed and won, its save stored, not folded.
 */
test("a campaign win left by Back to title is folded when the campaign continues", async ({ page }) => {
  test.setTimeout(240_000);
  await installWave6Helpers(page);
  await page.goto("/?unlock=all");
  await waitForScene(page, "Title");

  const runId = await page.evaluate(async () => {
    const handle = (window as unknown as { __mcCampaign: { seedDesignWon(): Promise<{ runId: string }> } })
      .__mcCampaign;
    return (await handle.seedDesignWon()).runId;
  });
  await page.evaluate(() => {
    const game = (window as unknown as { __mcGame: any }).__mcGame;
    for (const scene of game.scene.getScenes(true))
      if (scene.sys.settings.key !== "MusicScene") game.scene.stop(scene.sys.settings.key);
    game.scene.start("GameOver");
  });
  await waitForScene(page, "GameOver", 40_000);
  await settle(page, { quietMs: 800, maxMs: 5000 });

  // The player leaves by the title button, not "Continue the campaign".
  await clickText(page, "Back to title", { sceneKey: "GameOver" });
  await openSaga(page);
  await clickText(page, "Continue", { sceneKey: "CampaignSaga" });

  // The won game is folded rather than replayed: Aftermath, never the Briefing that starts the same mission.
  await waitForScene(page, "CampaignAftermath", 40_000);
  expect(await screens(page)).not.toContain("CampaignBriefing");
  await settle(page, { quietMs: 1000, maxMs: 5000 });
  const dir = process.env.E2E_SHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/campaign-win-back-to-title-aftermath.png` });

  // The fold wrote the result and names the finished game in the history.
  const record = await page.evaluate(async (id) => {
    const service = (
      window as unknown as {
        __mcCampaign: {
          service: { load(id: string): Promise<{ attempt?: unknown; history: { gameId: string | null }[] }> };
        };
      }
    ).__mcCampaign.service;
    for (let tries = 0; tries < 50; tries++) {
      const loaded = await service.load(id);
      if (!loaded.attempt) return { attempt: false, lastGameId: loaded.history.at(-1)?.gameId ?? null };
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return { attempt: true, lastGameId: null };
  }, runId);
  expect(record.attempt, "the issue is folded, so it is not offered again").toBe(false);
  expect(record.lastGameId, "the history links the game that was played").not.toBeNull();
});
