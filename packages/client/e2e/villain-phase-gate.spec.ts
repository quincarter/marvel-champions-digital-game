import { expect, test, type Page } from "@playwright/test";
import { pressAt, settle, waitFor } from "./helpers.js";
import { villainDebugRect } from "./overlay-helpers.js";
import { answerChoiceSheet, installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import type { Rect } from "./wave6-helpers-b.js";

/**
 * The docked villain phase at the game's default, Auto-advance off (the owner, 2026-10-14): it opens on START VILLAIN
 * PHASE with nothing played and no sheet over the cards; once started, the player's own interrupt answers on the
 * panel, and a decision that is not one (declaring a defender) comes up as a notice whose ANSWER brings its sheet.
 * Played from the `?screen=villain-interrupt` jump: a real Rhino game paused on Spider-Man's Spider-Sense.
 */

const sheetShown = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const game = (
      window as unknown as {
        __mcGame: { scene: { getScene(k: string): { sys: { isActive(): boolean; settings: { visible: boolean } } } } };
      }
    ).__mcGame;
    const sheet = game.scene.getScene("ChoiceOverlay");
    return sheet.sys.isActive() && sheet.sys.settings.visible;
  });

const press = async (page: Page, phone: boolean, rect: Rect): Promise<void> => {
  // A control drawn this frame takes presses from the next one: let the screen settle first.
  await settle(page);
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  if (phone) await page.touchscreen.tap(x, y);
  else await pressAt(page, x, y);
  await settle(page);
};

test("the villain phase waits for START, answers its interrupt on the panel, and holds a defend behind ANSWER", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await page.addInitScript(() =>
    localStorage.setItem("mc-settings", JSON.stringify({ version: 1, villainAutoAdvance: "off" })),
  );
  await installWave6Helpers(page);
  await page.goto("/?screen=villain-interrupt");

  // Opens on START: nothing played, the Spider-Sense sheet hidden under the phase.
  const start = await waitFor(() => villainDebugRect(page, "startRect"), "START VILLAIN PHASE", 30_000);
  expect(await sheetShown(page), "no sheet over the cards before START").toBe(false);
  expect(await villainDebugRect(page, "resolveRect"), "the interrupt window waits for START").toBeNull();

  // Started: the player's own interrupt answers on the panel.
  await press(page, phone, start);
  const resolve = await waitFor(() => villainDebugRect(page, "resolveRect"), "the interrupt window", 15_000);
  expect(await sheetShown(page)).toBe(false);
  await press(page, phone, resolve);

  // Rhino's attack asks for a defender: a notice with ANSWER, the sheet still hidden until it is pressed.
  const answer = await waitFor(() => villainDebugRect(page, "answerRect"), "the defend notice", 15_000);
  expect(await sheetShown(page), "the defend sheet waits behind ANSWER").toBe(false);
  await press(page, phone, answer);
  await waitFor(async () => ((await sheetShown(page)) ? true : null), "ANSWER brings the sheet", 10_000);
  await answerChoiceSheet(page);
  expect(errors).toEqual([]);
});
