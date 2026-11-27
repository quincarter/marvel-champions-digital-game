import { expect, test, type Page } from "@playwright/test";
import { findText, settle, waitFor } from "./helpers.js";
import { clickStop, installWave6Helpers, routeStops, trackErrors, waitForScene } from "./wave6-helpers-a.js";

/**
 * The campaign Saga and Cover are Lit panels over the canvas (phase 6 of the Lit migration): the same controls under the
 * same stop keys, the box's name, tagline and pitch, and the whole thing in Spanish when the app is. A seeded run of
 * The Rise of Red Skull (issue 3 next) gives the Cover its Read issue button, Dossier and Issues.
 */

async function seedAndOpenSaga(page: Page): Promise<void> {
  await installWave6Helpers(page);
  await page.goto("/?unlock=all");
  await waitForScene(page, "Title", 30_000);
  await page.evaluate(async () => {
    await (window as unknown as { __mcCampaign: { seed(stop: string): Promise<unknown> } }).__mcCampaign.seed(
      "afterIssue2",
    );
  });
  await page.goto("/?unlock=all&screen=saga");
  await waitForScene(page, "CampaignSaga");
  await waitFor(
    async () => ((await routeStops(page, "CampaignSaga"))?.stops.some((s) => s.key === "cta") ? true : null),
    "the Saga's big button",
    20_000,
  );
  await settle(page);
}

test("the Cover keeps its controls, says the next issue, and Back returns to the Saga", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await seedAndOpenSaga(page);
  expect((await findText(page, "IN PROGRESS", "CampaignSaga")).length, "the featured status line").toBeGreaterThan(0);
  await clickStop(page, "cta", "CampaignSaga");
  await waitForScene(page, "CampaignCover", 20_000);
  await waitFor(
    async () => ((await routeStops(page, "CampaignCover"))?.stops.some((s) => s.key === "cta") ? true : null),
    "the Cover's controls",
    20_000,
  );
  const keys = (await routeStops(page, "CampaignCover"))!.stops.map((stop) => stop.key);
  for (const key of ["back", "cta", "dossier", "issues", "expert"]) expect(keys, key).toContain(key);
  expect((await findText(page, "READ ISSUE #3", "CampaignCover")).length).toBeGreaterThan(0);
  expect((await findText(page, "A STORY IN FIVE ISSUES", "CampaignCover")).length).toBeGreaterThan(0);
  expect(
    (await findText(page, "MC10 · CAMPAIGN BOX", "CampaignCover")).length +
      (await findText(page, "MC10", "CampaignCover")).length,
  ).toBeGreaterThan(0);

  await clickStop(page, "back", "CampaignCover");
  await waitForScene(page, "CampaignSaga", 20_000);
  expect(errors).toEqual([]);
});

test("the Saga and the Cover read in Spanish, with the official box name", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    localStorage.setItem("mc-settings", JSON.stringify({ version: 1, cardLanguage: "es" }));
  });
  await seedAndOpenSaga(page);
  expect((await findText(page, "LA SAGA", "CampaignSaga")).length).toBeGreaterThan(0);
  expect((await findText(page, "LA TIRANÍA DE CRÁNEO ROJO", "CampaignSaga")).length).toBeGreaterThan(0);
  expect((await findText(page, "EN CURSO", "CampaignSaga")).length).toBeGreaterThan(0);
  expect((await findText(page, "CONTINUAR", "CampaignSaga")).length).toBeGreaterThan(0);
  await clickStop(page, "cta", "CampaignSaga");
  await waitForScene(page, "CampaignCover", 20_000);
  await waitFor(
    async () => ((await findText(page, "LEER EL NÚMERO 3", "CampaignCover")).length > 0 ? true : null),
    "the Cover's Read issue button in Spanish",
    20_000,
  );
  expect((await findText(page, "UNA HISTORIA EN CINCO NÚMEROS", "CampaignCover")).length).toBeGreaterThan(0);
  expect((await findText(page, "EXPEDIENTE", "CampaignCover")).length).toBeGreaterThan(0);
});
