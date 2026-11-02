import { expect, test, type Page } from "@playwright/test";
import { findText, settle, waitFor } from "./helpers.js";
import { clickStop, installWave6Helpers, routeStops, trackErrors, waitForScene } from "./wave6-helpers-a.js";

/**
 * Issue #631: a campaign deck is edited on the deck builder itself, with what that screen offers a loose deck (From
 * your games, Review), and the pool stays cheap to draw while it scrolls.
 */

async function openCampaignDeck(page: Page): Promise<void> {
  await installWave6Helpers(page);
  await page.goto("/?unlock=all&screen=campaign-briefing&campaign=trors");
  await waitForScene(page, "CampaignBriefing");
  await settle(page);
  await clickStop(page, "deck-seat-1", "CampaignBriefing");
  await waitForScene(page, "DeckBuilder");
  await settle(page);
}

test("campaign deck edit has From your games and Review, and Review keeps unsaved edits", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "the narrow layout's tabs");
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await openCampaignDeck(page);

  await clickStop(page, "tab:games", "DeckBuilder");
  await waitFor(async () => ((await findText(page, "Reading your games")).length === 0 ? true : null), "the stats");

  await clickStop(page, "tab:pool", "DeckBuilder");
  const card = (await routeStops(page, "DeckBuilder"))?.stops.find((s) => s.key.startsWith("card:") && s.rect.y > 150);
  expect(card, "a pool card").toBeTruthy();
  await page.touchscreen.tap(card!.rect.x + card!.rect.width - 24, card!.rect.y + card!.rect.height - 26);
  await settle(page, { quietMs: 250, maxMs: 1000 });

  await clickStop(page, "tab:deck", "DeckBuilder");
  await clickStop(page, "deck-review", "DeckBuilder");
  await waitForScene(page, "DeckCheck");
  await settle(page);
  // The campaign judges the deck, so a deck over its 40 with room for its grants still reads legal or illegal here.
  expect((await findText(page, "LEGAL", "DeckCheck")).length).toBeGreaterThan(0);

  await clickStop(page, "edit-deck", "DeckCheck");
  await waitForScene(page, "DeckBuilder");
  await settle(page);
  await clickStop(page, "back", "DeckBuilder");
  await settle(page);
  expect((await findText(page, "unsaved changes")).length, "the added card still counts as unsaved").toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("Review on a narrow screen counts a campaign deck as the campaign does, leaving its pinned cards out", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "phone", "the narrow layout's title");
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?unlock=all");
  await waitForScene(page, "Title");
  await page.evaluate(async () => {
    const w = window as unknown as {
      __mcCampaign: { seedGmw(stop: string): Promise<{ id: string }> };
      __mcGame: {
        scene: {
          getScenes(active: boolean): { sys: { settings: { key: string } } }[];
          stop(key: string): void;
          start(key: string, data: object): void;
        };
      };
    };
    const { id } = await w.__mcCampaign.seedGmw("afterIssue2");
    for (const scene of w.__mcGame.scene.getScenes(true))
      if (scene.sys.settings.key !== "MusicScene") w.__mcGame.scene.stop(scene.sys.settings.key);
    w.__mcGame.scene.start("CampaignDeckEdit", {
      runId: id,
      seatNumber: 1,
      returnTo: { key: "CampaignDossier", data: { runId: id } },
    });
  });
  await waitForScene(page, "DeckBuilder", 40_000);
  await settle(page);
  await clickStop(page, "tab:deck", "DeckBuilder");
  await clickStop(page, "deck-review", "DeckBuilder");
  await waitForScene(page, "DeckCheck");
  await settle(page);

  const badge = (await findText(page, "PINNED", "DeckCheck"))[0]?.text ?? "";
  const counted = /^(\d+) CARDS \+ \d+ PINNED/i.exec(badge)?.[1];
  expect(counted, `a pinned count in "${badge}"`).toBeTruthy();
  expect((await findText(page, `Your deck · ${counted}`, "DeckCheck")).length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test.describe("a tablet held sideways", () => {
  test.use({ viewport: { width: 1180, height: 820 } });

  test("folds the filters behind a chip that opens them in the pool's place", async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "a touch screen");
    test.setTimeout(120_000);
    const errors = trackErrors(page);
    await openCampaignDeck(page);
    const keys = async (): Promise<string[]> =>
      ((await routeStops(page, "DeckBuilder"))?.stops ?? []).map((stop) => stop.key);
    expect(await keys()).toContain("filters-toggle");
    expect(await keys()).not.toContain("type:ally");
    expect(await keys()).toContain("chart:odds");

    await clickStop(page, "filters-toggle", "DeckBuilder");
    await settle(page);
    expect(await keys()).toContain("type:ally");
    await clickStop(page, "type:ally", "DeckBuilder");
    await clickStop(page, "filters-toggle", "DeckBuilder");
    await settle(page);
    expect((await findText(page, "Filters · 1", "DeckBuilder")).length).toBeGreaterThan(0);
    expect((await keys()).some((key) => key.startsWith("card:"))).toBe(true);
    expect(errors).toEqual([]);
  });
});

test.describe("an upright tablet", () => {
  test.use({ viewport: { width: 820, height: 1180 } });

  test("stacks the selected campaign over the volume list, as a phone does", async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "a touch screen");
    test.setTimeout(120_000);
    const errors = trackErrors(page);
    await installWave6Helpers(page);
    await page.goto("/?unlock=all&screen=saga");
    await waitForScene(page, "CampaignSaga");
    await settle(page);
    const stops = (await routeStops(page, "CampaignSaga"))?.stops ?? [];
    const second = stops.find((stop) => stop.key === "vol-2");
    expect(second, "a volume row").toBeTruthy();
    // A full-width row, not a grid tile.
    expect(second!.rect.width).toBeGreaterThan(700);
    await page.touchscreen.tap(second!.rect.x + 200, second!.rect.y + second!.rect.height / 2);
    await waitFor(
      async () => ((await findText(page, "START VOL. 2", "CampaignSaga")).length > 0 ? true : null),
      "vol 2",
    );
    expect(errors).toEqual([]);
  });
});

test.describe("the pool at tablet size", () => {
  test.use({ viewport: { width: 820, height: 1180 } });

  test("draws in batches, not an object at a time", async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "one project is enough");
    test.setTimeout(120_000);
    await installWave6Helpers(page);
    await page.goto("/?unlock=all&screen=deck-builder&redraw=always");
    await waitForScene(page, "DeckBuilder");
    await settle(page);
    const drawsPerFrame = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const game = (window as unknown as { __mcGame: { renderer: { gl: WebGLRenderingContext } } }).__mcGame;
          const gl = game.renderer.gl;
          let draws = 0;
          let frames = 0;
          const drawElements = gl.drawElements.bind(gl);
          const drawArrays = gl.drawArrays.bind(gl);
          gl.drawElements = (...args) => {
            draws++;
            drawElements(...args);
          };
          gl.drawArrays = (...args) => {
            draws++;
            drawArrays(...args);
          };
          const tick = (): void => {
            if (++frames < 30) requestAnimationFrame(tick);
            else resolve(draws / frames);
          };
          requestAnimationFrame(tick);
        }),
    );
    // 186 when every button and card panel had its own Graphics: each one ended a batch.
    expect(drawsPerFrame).toBeLessThan(110);
  });
});
