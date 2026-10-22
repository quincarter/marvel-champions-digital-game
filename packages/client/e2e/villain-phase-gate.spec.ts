import { expect, test, type Page } from "@playwright/test";
import { pressAt, settle, waitFor } from "./helpers.js";
import { villainDebugRect } from "./overlay-helpers.js";
import { answerChoiceSheet, installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import type { Rect } from "./wave6-helpers-b.js";

/**
 * The docked villain phase at the game's default, Auto-advance off (the owner, 2026-10-14): it opens on START VILLAIN
 * PHASE with nothing played and no sheet over the cards; once started, the player's own interrupt answers on the
 * panel, and a decision that is not one (declaring a defender) comes up as a notice whose ANSWER brings the defend
 * panel docked in the (widened) phase, with EXPAND for the full-screen sheet.
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

/** Starts the jump's phase, lets Spider-Sense resolve, and presses ANSWER on Rhino's defend notice. */
async function reachDockedDefend(page: Page, phone: boolean): Promise<void> {
  await page.addInitScript(() =>
    localStorage.setItem(
      "mc-settings",
      JSON.stringify({ version: 1, villainAutoAdvance: "off", flipEncounterCards: false, holdEncounterCards: false }),
    ),
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
  expect(await sheetShown(page), "the defend waits behind ANSWER").toBe(false);
  await press(page, phone, answer);
}

test("the villain phase waits for START, answers its interrupt on the panel, and confirms a defender in the docked panel", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await reachDockedDefend(page, phone);

  // ANSWER goes straight into the docked defend panel, not the sheet.
  const confirm = await waitFor(() => villainDebugRect(page, "confirmRect"), "the docked defend panel", 10_000);
  expect(await sheetShown(page), "the defend is answered in the dock, not on the sheet").toBe(false);
  expect(await villainDebugRect(page, "expandRect")).not.toBeNull();
  const ids = await page.evaluate(
    () =>
      (
        window as unknown as { __mcVillainPhaseDebug?: { defendOptionIds?: () => string[] } }
      ).__mcVillainPhaseDebug?.defendOptionIds?.() ?? [],
  );
  expect(ids.length, "No defense and at least one defender").toBeGreaterThanOrEqual(2);
  const option = await page.evaluate((id) => {
    const dbg = (window as unknown as { __mcVillainPhaseDebug?: { defendOptionRect?: (id: string) => Rect | null } })
      .__mcVillainPhaseDebug;
    return dbg?.defendOptionRect?.(id) ?? null;
  }, ids[1]!);
  expect(option, "the defender's option card").not.toBeNull();
  await press(page, phone, option!);
  await press(page, phone, (await villainDebugRect(page, "confirmRect")) ?? confirm);

  // The decision is answered: the dock goes on with the phase.
  await waitFor(
    async () => ((await villainDebugRect(page, "confirmRect")) ? null : true),
    "the defend answered",
    15_000,
  );
  expect(errors).toEqual([]);
});

test("EXPAND on the docked defend opens the full-screen sheet", async ({ page }, info) => {
  test.setTimeout(120_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await reachDockedDefend(page, phone);
  const expand = await waitFor(() => villainDebugRect(page, "expandRect"), "EXPAND on the docked defend", 10_000);
  expect(await sheetShown(page)).toBe(false);
  await press(page, phone, expand);
  await waitFor(async () => ((await sheetShown(page)) ? true : null), "EXPAND brings the sheet", 10_000);
  await answerChoiceSheet(page);
  expect(errors).toEqual([]);
});
