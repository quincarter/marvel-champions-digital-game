import { expect, test } from "@playwright/test";
import { findText, settle } from "./helpers.js";
import { assertNoRawText, installWave6Helpers, routeStops, screens, waitForScene } from "./wave6-helpers-a.js";

/**
 * NeXt Evolution (MC40, wave 7), a retry's Briefing. Scenario 1 is conceded once, which folds the loss and leaves the
 * run at issue #1's start with the first pick still in the log; composing it again repeats the player side scheme pick
 * with no prompt (`choose.repeatOnRetry`, MC40 p. 7: "if you replay a scenario, choose the same player side scheme").
 * The Briefing (`view/campaign-side-scheme-model.ts`, `scenes/campaign/briefing-side-scheme.ts`) must then show the
 * chosen row with its "Same as last time" marker, offer no picker (no PICK button, no other row), and leave Open issue
 * available. The run comes from `seedNextEvolRun(service, "lostIssue1")` in `campaign/dev-fixtures.ts`, loaded by a
 * dynamic import of the dev module (the `__mcCampaign` handle in `main.ts` does not list it), then the Briefing is
 * started on it directly. Desktop only; the 390 layout is covered by the QA write-up's screenshots.
 */
test("a retry's Briefing shows the repeated side scheme with no picker, and Open issue is enabled", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await installWave6Helpers(page);
  await page.goto("/?unlock=all");
  await waitForScene(page, "Title");

  const runId = await page.evaluate(async () => {
    const fixtures = (await import("/src/campaign/dev-fixtures.ts")) as {
      seedNextEvolRun(service: unknown, stop: string): Promise<{ id: string }>;
    };
    const service = (window as unknown as { __mcCampaign: { service: unknown } }).__mcCampaign.service;
    return (await fixtures.seedNextEvolRun(service, "lostIssue1")).id;
  });
  await page.evaluate((id) => {
    const game = (window as unknown as { __mcGame: any }).__mcGame;
    for (const scene of game.scene.getScenes(true)) game.scene.stop(scene.sys.settings.key);
    game.scene.start("CampaignBriefing", { runId: id });
  }, runId);
  await waitForScene(page, "CampaignBriefing");
  await settle(page);
  await expect
    .poll(async () => (await findText(page, "SAME AS LAST TIME", "CampaignBriefing")).length)
    .toBeGreaterThan(0);
  await assertNoRawText(page, "retry briefing");

  // The chosen row is shown (the pick the first attempt made), under the Side scheme section.
  expect((await findText(page, "SAFEHOUSE ESTABLISHED", "CampaignBriefing")).length, "the chosen row").toBeGreaterThan(
    0,
  );
  // No picker: no other scheme is offered, and no PICK control exists.
  for (const other of ["MISSION PREP", "ASSEMBLE THE TEAM", "GEAR UP", "PRACTICE MANEUVERS", "PREPARE DEFENSES"]) {
    expect((await findText(page, other, "CampaignBriefing")).length, `${other} is not offered`).toBe(0);
  }
  expect((await findText(page, "PICK", "CampaignBriefing")).filter((t) => t.text.trim() === "PICK")).toHaveLength(0);

  const route = await routeStops(page, "CampaignBriefing");
  const keys = route?.stops.map((stop) => stop.key) ?? [];
  expect(keys, "Open issue is a live control").toContain("open");
  expect(
    keys.filter((key) => /option|pick/.test(key)),
    "no pick controls",
  ).toEqual([]);

  // Pressing it leaves the Briefing (it is enabled): the issue opens.
  const open = route!.stops.find((stop) => stop.key === "open")!;
  await page.mouse.click(open.rect.x + open.rect.width / 2, open.rect.y + open.rect.height / 2);
  await expect.poll(async () => (await screens(page)).includes("CampaignBriefing"), { timeout: 30_000 }).toBe(false);
});
