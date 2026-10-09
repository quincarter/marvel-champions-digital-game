import { expect, test } from "@playwright/test";
import { settle } from "./helpers.js";
import { assertNoRawText, clickStop, installWave6Helpers, screens, waitForScene } from "./wave6-helpers-a.js";

/**
 * NeXt Evolution (MC40), the last issue's aftermath. The fold of the final win used to jump straight to the Finale
 * (`scenes/campaign/aftermath.ts` `#onFolded`), so issue 5's `aftermathBeats` never showed. A won last issue now plays
 * its beats on the Aftermath screen, and the last beat's button leads to the Finale. The run is the
 * `seedNextEvolWon("afterIssue4")` QA fixture: issue 5 composed and won, not folded.
 */
test("the last issue's aftermath beats play before the Finale", async ({ page }) => {
  test.setTimeout(240_000);
  await installWave6Helpers(page);
  await page.goto("/?unlock=all");
  await waitForScene(page, "Title");

  const runId = await page.evaluate(async () => {
    const handle = (
      window as unknown as { __mcCampaign: { seedNextEvolWon(stop: string): Promise<{ runId: string }> } }
    ).__mcCampaign;
    return (await handle.seedNextEvolWon("afterIssue4")).runId;
  });
  await page.evaluate((id) => {
    const game = (window as unknown as { __mcGame: any }).__mcGame;
    for (const scene of game.scene.getScenes(true))
      if (scene.sys.settings.key !== "MusicScene") game.scene.stop(scene.sys.settings.key);
    game.scene.start("CampaignAftermath", { runId: id });
  }, runId);

  // The fold lands on the Aftermath's comic beats, not the Finale.
  await waitForScene(page, "CampaignAftermath", 40_000);
  await settle(page, { quietMs: 1000, maxMs: 5000 });
  expect(await screens(page), "the aftermath holds; the Finale is not up yet").not.toContain("CampaignFinale");
  await assertNoRawText(page, "last aftermath, first beat");
  const dir = process.env.E2E_SHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/last-aftermath-beat1.png` });

  // Step through the four beats; the last button says it goes to the Finale.
  for (let beat = 0; beat < 3; beat++) {
    await clickStop(page, "next", "CampaignAftermath");
    await settle(page, { quietMs: 600, maxMs: 4000 });
    expect(await screens(page)).not.toContain("CampaignFinale");
  }
  if (dir) await page.screenshot({ path: `${dir}/last-aftermath-last-beat.png` });
  await clickStop(page, "next", "CampaignAftermath");
  await waitForScene(page, "CampaignFinale", 40_000);
  await settle(page, { quietMs: 1000, maxMs: 5000 });
  if (dir) await page.screenshot({ path: `${dir}/finale.png` });
});
