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
