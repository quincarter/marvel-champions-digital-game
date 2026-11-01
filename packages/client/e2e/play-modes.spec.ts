import { expect, test, type Page } from "@playwright/test";
import { activeScenes, findText, settle, trackPageErrors, waitFor } from "./helpers.js";
import { clickStop, installWave6Helpers, routeStops, waitForScene } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Heroic and Skirmish modes (RRG 1.8 "Modes of Play", p. 29; issue #611): chosen on Set the table beside Standard and
 * Expert, in any combination, and on a campaign Briefing for one issue. Every control is a focus stop, so a controller
 * reaches it the way it reaches the rest of the screen.
 */

const stopKeys = async (page: Page, scene: string): Promise<readonly string[]> =>
  ((await routeStops(page, scene))?.stops ?? []).map((stop) => stop.key);

test("Set the table: heroic and skirmish combine with expert and show in the summary", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = trackPageErrors(page);
  await installWave6Helpers(page);
  await openApp(page, "unlock=all&screen=table-setup&scenario=rhino&seed=1", { landing: "Setup" });
  const scene = "Setup";

  const before = await stopKeys(page, scene);
  for (const key of ["option:heroic:up", "option:skirmish:off", "option:skirmish:1", "option:skirmish:2"])
    expect(before).toContain(key);

  await clickStop(page, "option:heroic:up", scene);
  await clickStop(page, "option:heroic:up", scene);
  await clickStop(page, "option:skirmish:2", scene);
  await waitFor(() => findText(page, "2 extra encounter cards each"), "the heroic line");
  await waitFor(() => findText(page, "Only stage II"), "the skirmish line");

  // Expert moves the versions on: stage I leaves the offer and III joins it.
  await clickStop(page, "difficulty:expert", scene);
  const expert = await waitFor(async () => {
    const keys = await stopKeys(page, scene);
    return keys.includes("option:skirmish:3") ? keys : null;
  }, "the expert versions");
  expect(expert).not.toContain("option:skirmish:1");

  await clickStop(page, "deal-it-out", scene);
  // The game built: the screen moves on to the scenario's comic.
  await waitFor(async () => !(await activeScenes(page)).includes(scene), "the game dealt");
  expect(errors).toEqual([]);
});

test("Set the table: a scenario where one version cannot stand alone has no Skirmish, and keeps Heroic", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await installWave6Helpers(page);
  await openApp(page, "unlock=all&screen=table-setup&scenario=kang&seed=1", { landing: "Setup" });
  const keys = await stopKeys(page, "Setup");
  expect(keys).toContain("option:heroic:up");
  expect(keys.some((key) => key.startsWith("option:skirmish:"))).toBe(false);
});

test("a campaign Briefing sets the modes for one issue and composes it under them", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = trackPageErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?unlock=all");
  await waitForScene(page, "Title");
  const runId = await page.evaluate(async () => {
    const campaign = (window as unknown as { __mcCampaign: { seed(stop: string): Promise<{ id: string }> } })
      .__mcCampaign;
    return (await campaign.seed("afterIssue2")).id;
  });
  await page.evaluate((id) => {
    const game = (window as unknown as { __mcGame: any }).__mcGame;
    for (const active of game.scene.getScenes(true)) game.scene.stop(active.sys.settings.key);
    game.scene.start("CampaignBriefing", { runId: id });
  }, runId);
  await waitForScene(page, "CampaignBriefing");
  await settle(page);

  await clickStop(page, "mode:expert:on", "CampaignBriefing");
  await waitFor(async () => (await stopKeys(page, "CampaignBriefing")).includes("mode:expert:off"), "composed again");
  await clickStop(page, "mode:heroic:up", "CampaignBriefing");

  const attemptModes = () =>
    page.evaluate(async (id) => {
      const campaign = (
        window as unknown as {
          __mcCampaign: { service: { load(id: string): Promise<{ attempt?: { modes: unknown } } | null> } };
        }
      ).__mcCampaign;
      return (await campaign.service.load(id))?.attempt?.modes ?? null;
    }, runId);
  const modes = await waitFor(async () => {
    const now = (await attemptModes()) as { expert?: boolean; heroic?: number } | null;
    return now?.heroic === 1 ? now : null;
  }, "the issue composed under Expert and Heroic 1");
  expect(modes).toMatchObject({ expert: true, heroic: 1 });
  expect(errors).toEqual([]);
});
