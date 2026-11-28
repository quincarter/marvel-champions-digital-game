import { expect, test, type Page } from "@playwright/test";
import { revealText } from "./briefing-helpers.js";
import { findText, settle } from "./helpers.js";
import {
  assertNoRawText,
  clickStop,
  installWave6Helpers,
  routeStops,
  screens,
  scrollStopIntoView,
  trackErrors,
  waitForScene,
} from "./wave6-helpers-a.js";

/**
 * Agents of S.H.I.E.L.D. (MC50), the Briefing between scenarios. A signed run is played through scenario 1 (the
 * dev seed `seedAosRun`: each win is substituted, with the Board Members' secrets set so the Victory steps really
 * record the board and gain one evidence card), then the Briefing for scenario 2 shows the case file from the log:
 * the evidence held as a card picture that opens Inspect, the three Board Members with their secrets, and the numbers
 * the next Setup reads. The sealed A.I.M. envelope's cards must appear nowhere on screen.
 */

async function openBriefing(page: Page): Promise<{ runId: string }> {
  await installWave6Helpers(page);
  await page.goto("/?unlock=all");
  await waitForScene(page, "Title");
  const runId = await page.evaluate(async () => {
    const fixtures = (await import("/src/campaign/dev-fixtures.ts")) as {
      seedAosRun(service: unknown, stop: string): Promise<{ id: string }>;
    };
    const service = (window as unknown as { __mcCampaign: { service: unknown } }).__mcCampaign.service;
    return (await fixtures.seedAosRun(service, "afterIssue1")).id;
  });
  await page.evaluate((id) => {
    const game = (window as unknown as { __mcGame: any }).__mcGame;
    for (const scene of game.scene.getScenes(true)) game.scene.stop(scene.sys.settings.key);
    game.scene.start("CampaignBriefing", { runId: id });
  }, runId);
  await waitForScene(page, "CampaignBriefing");
  await settle(page);
  return { runId };
}

/** The names of the three cards sealed in the A.I.M. envelope, read from the stored run (the test may; the screens may not). */
const sealedNames = (page: Page, runId: string): Promise<string[]> =>
  page.evaluate(async (id) => {
    const pool = (await import("/src/content/pool.ts")) as { CARDS_BY_ID: Map<string, { name: string }> };
    const service = (
      window as unknown as { __mcCampaign: { service: { storage: { load(id: string): Promise<any> } } } }
    ).__mcCampaign.service;
    const record = await service.storage.load(id);
    const cardIds: string[] = record.hidden.aimEnvelope.cardIds;
    return cardIds.map((card) => pool.CARDS_BY_ID.get(card)?.name ?? card);
  }, runId);

test("after scenario 1 the Briefing's case file shows the evidence, the board and the carried numbers, and never the sealed envelope", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  const { runId } = await openBriefing(page);

  await expect.poll(async () => (await findText(page, "THE CASE FILE", "CampaignBriefing")).length).toBeGreaterThan(0);
  await revealText(page, "EVIDENCE · 1 GAINED");
  expect((await findText(page, "EVIDENCE · 1 GAINED", "CampaignBriefing")).length).toBeGreaterThan(0);
  await revealText(page, "EXECUTIVE BOARD · AFTER SCENARIO #1");
  expect((await findText(page, "EXECUTIVE BOARD · AFTER SCENARIO #1", "CampaignBriefing")).length).toBeGreaterThan(0);
  await revealText(page, "A Board Member flips at 4 secrets");
  expect(
    (await findText(page, "A Board Member flips at 4 secrets and stays flipped.", "CampaignBriefing")).length,
  ).toBe(1);
  // One evidence card crosses out the 9 combinations that include it; the envelope is only a count.
  await revealText(page, "18 of 27 combinations still open");
  expect((await findText(page, "18 of 27 combinations still open", "CampaignBriefing")).length).toBeGreaterThan(0);
  await revealText(page, "holds 3 sealed cards");
  expect((await findText(page, "holds 3 sealed cards", "CampaignBriefing")).length).toBeGreaterThan(0);
  await revealText(page, "Alert Level");
  expect((await findText(page, "Alert Level", "CampaignBriefing")).length).toBeGreaterThan(0);
  await assertNoRawText(page, "the case file");

  // Nothing on screen names a card sealed in the A.I.M. envelope.
  for (const name of await sealedNames(page, runId)) {
    expect((await findText(page, name, "CampaignBriefing")).length, `${name} stays sealed`).toBe(0);
  }

  // The evidence and each Board Member are pictures that open Inspect; reading one answers nothing.
  const keys = (await routeStops(page, "CampaignBriefing"))?.stops.map((stop) => stop.key) ?? [];
  for (const key of ["shield-evidence-0", "shield-board-0", "shield-board-1", "shield-board-2"]) {
    expect(keys, key).toContain(key);
  }
  await scrollStopIntoView(page, "shield-board-0", "CampaignBriefing");
  await clickStop(page, "shield-board-0", "CampaignBriefing");
  await expect.poll(async () => (await screens(page)).includes("InspectOverlay")).toBe(true);
  await expect
    .poll(async () => (await findText(page, "CHIEF MEDICAL OFFICER", "InspectOverlay")).length)
    .toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await screens(page)).includes("InspectOverlay")).toBe(false);
  await settle(page);
  expect(
    (await routeStops(page, "CampaignBriefing"))?.stops.map((stop) => stop.key),
    "Open issue is still there",
  ).toContain("open");
  expect(errors).toEqual([]);
});
