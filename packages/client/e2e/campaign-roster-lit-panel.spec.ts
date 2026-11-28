import { expect, test, type Page } from "@playwright/test";
import { findText, settle, waitFor } from "./helpers.js";
import { clickStop, installWave6Helpers, routeStops, trackErrors, waitForScene } from "./wave6-helpers-a.js";

/**
 * The campaign Roster is a Lit panel over the canvas (phase 6 of the Lit migration): the same stop keys (`back`, `seat-1`
 * to `seat-4`, `cta`, and `pick-*` while a seat's deck picker is open), the box's banner, the seats and the picker, in
 * English and in Spanish.
 */

async function openRoster(page: Page): Promise<void> {
  await installWave6Helpers(page);
  await page.goto("/?unlock=all");
  await waitForScene(page, "Title", 30_000);
  await page.evaluate(() => {
    const game = (window as unknown as { __mcGame: any }).__mcGame;
    for (const scene of game.scene.getScenes(true))
      if (scene.sys.settings.key !== "MusicScene") game.scene.stop(scene.sys.settings.key);
    game.scene.start("CampaignRoster", { campaignId: "trors" });
  });
  await waitForScene(page, "CampaignRoster", 20_000);
  await waitFor(
    async () => ((await routeStops(page, "CampaignRoster"))?.stops.some((s) => s.key === "cta") ? true : null),
    "the Roster's controls",
    20_000,
  );
  await settle(page);
}

const keysOf = async (page: Page): Promise<string[]> =>
  ((await routeStops(page, "CampaignRoster"))?.stops ?? []).map((stop) => stop.key);

test("the Roster keeps its controls, opens a seat's picker and takes a hero out of a seat", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await openRoster(page);
  const keys = await keysOf(page);
  for (const key of ["back", "seat-1", "seat-2", "seat-3", "seat-4", "cta"]) expect(keys, key).toContain(key);
  expect((await findText(page, "SIGN THE ROSTER", "CampaignRoster")).length).toBeGreaterThan(0);
  expect((await findText(page, "WHOEVER SIGNS HERE", "CampaignRoster")).length, "the box's banner").toBeGreaterThan(0);
  expect((await findText(page, "+ SEAT #3", "CampaignRoster")).length, "an empty seat").toBeGreaterThan(0);

  await clickStop(page, "seat-2", "CampaignRoster");
  await waitFor(
    async () => ((await keysOf(page)).includes("pick-remove") ? true : null),
    "the picker's controls",
    15_000,
  );
  expect(await keysOf(page), "the picker is the whole route").not.toContain("cta");
  expect((await findText(page, "SEAT #2", "CampaignRoster")).length).toBeGreaterThan(0);
  await clickStop(page, "pick-remove", "CampaignRoster");
  await waitFor(
    async () => ((await findText(page, "+ SEAT #2", "CampaignRoster")).length > 0 ? true : null),
    "seat 2 is empty",
    15_000,
  );
  expect(await keysOf(page)).toContain("cta");
  expect(errors).toEqual([]);
});

test("the Roster reads in Spanish", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    localStorage.setItem("mc-settings", JSON.stringify({ version: 1, cardLanguage: "es" }));
  });
  await openRoster(page);
  expect((await findText(page, "FIRMAR LA PLANTILLA", "CampaignRoster")).length).toBeGreaterThan(0);
  expect((await findText(page, "QUIEN FIRMA AQUÍ", "CampaignRoster")).length, "the banner").toBeGreaterThan(0);
  expect((await findText(page, "+ ASIENTO NÚM. 3", "CampaignRoster")).length).toBeGreaterThan(0);
  expect((await findText(page, "FIRMAR Y ABRIR EL NÚMERO 1", "CampaignRoster")).length).toBeGreaterThan(0);
  await clickStop(page, "seat-2", "CampaignRoster");
  await waitFor(
    async () => ((await findText(page, "ASIENTO NÚM. 2", "CampaignRoster")).length > 0 ? true : null),
    "the picker's title in Spanish",
    15_000,
  );
  expect((await findText(page, "QUITAR DE ESTE ASIENTO", "CampaignRoster")).length).toBeGreaterThan(0);
});
