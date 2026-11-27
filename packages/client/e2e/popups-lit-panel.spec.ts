import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickFocus, clickText, pressKey, settle, trackPageErrors, waitFor } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * The small pop-ups (the generic confirm, Concede, Ask for a change, Room chat) are Lit panels over the canvas, drawn
 * in the scenes' order: a pop-up opened over Pause sits above Pause's panel and Pause stays shown under its scrim. The
 * keyboard walks the pop-up's own stops with the DOM focus ring (Escape backs out, Enter presses the focused button).
 */

const CONFIRM = "EndTurnConfirmOverlay";

const confirmSheet = (page: Page) => page.locator(`#mc-ui [data-scene="${CONFIRM}"] mc-sheet`);
const pauseSheet = (page: Page) => page.locator('#mc-ui [data-scene="PauseOverlay"] mc-sheet');

const focusOf = (page: Page) =>
  page.evaluate(
    (key) =>
      (window as unknown as { __mcFocusState: Record<string, () => { focus: string | null }> }).__mcFocusState[key]!()
        .focus,
    CONFIRM,
  );

/** Opens the generic confirm over Pause, as Settings' cheat warnings do, counting what it answers. */
async function openConfirmOverPause(page: Page): Promise<void> {
  await page.evaluate((key) => {
    const w = window as unknown as {
      __mcGame: { scene: { getScene(k: string): { scene: { launch(k: string, d: unknown): void } } } };
      __confirmed: number;
      __cancelled: number;
    };
    w.__confirmed = 0;
    w.__cancelled = 0;
    w.__mcGame.scene.getScene("PauseOverlay").scene.launch(key, {
      title: "Turn it on?",
      sentence: "This is a test warning.",
      confirmLabel: "Turn on",
      cancelLabel: "Cancel",
      from: "PauseOverlay",
      onConfirm: () => (w.__confirmed += 1),
      onCancel: () => (w.__cancelled += 1),
    });
  }, CONFIRM);
  await expect(confirmSheet(page)).toBeVisible();
}

const counts = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __confirmed: number; __cancelled: number };
    return { confirmed: w.__confirmed, cancelled: w.__cancelled };
  });

test("a confirm over Pause is a panel above Pause's, Pause stays shown, Escape cancels and Enter confirms", async ({
  page,
}) => {
  const errors = trackPageErrors(page);
  await openApp(page, "screen=pause", { landing: "PauseOverlay" });
  await expect(pauseSheet(page)).toBeVisible();

  await openConfirmOverPause(page);
  await expect(confirmSheet(page).locator('[data-key="ok"]')).toBeVisible();
  // Pause's panel is still up and visible under the pop-up, and the pop-up's wrapper stacks above it.
  await expect(pauseSheet(page)).toBeVisible();
  const z = await page.evaluate(() => {
    const zOf = (scene: string): number =>
      Number(
        (document.querySelector(`#mc-ui [data-scene="${scene}"]`) as HTMLElement | null)?.style.zIndex ?? Number.NaN,
      );
    return { pause: zOf("PauseOverlay"), confirm: zOf("EndTurnConfirmOverlay") };
  });
  expect(z.confirm).toBeGreaterThan(z.pause);

  // Escape (B) cancels: the pop-up goes, Pause stays.
  await pressKey(page, "Escape");
  await expect(confirmSheet(page)).toHaveCount(0, { timeout: 10000 });
  expect(await counts(page)).toEqual({ confirmed: 0, cancelled: 1 });
  await expect(pauseSheet(page)).toBeVisible();

  // The ring walks the pop-up's own stops, in the panel layer, and Enter presses the focused one.
  await openConfirmOverPause(page);
  let focus: string | null = null;
  for (let i = 0; i < 4 && focus !== "ok"; i++) {
    await pressKey(page, "ArrowRight");
    focus = await focusOf(page);
  }
  expect(focus).toBe("ok");
  await expect(page.locator("#mc-ui .mc-focus-ring").last()).toBeVisible();
  await pressKey(page, "Enter");
  await expect(confirmSheet(page)).toHaveCount(0, { timeout: 10000 });
  expect(await counts(page)).toEqual({ confirmed: 1, cancelled: 0 });
  await expect(pauseSheet(page)).toBeVisible();
  expect(errors).toEqual([]);
});

test("pressing the confirm's button on the panel answers it", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openApp(page, "screen=pause", { landing: "PauseOverlay" });
  await openConfirmOverPause(page);
  await confirmSheet(page).locator('[data-key="ok"]').click();
  await expect(confirmSheet(page)).toHaveCount(0, { timeout: 10000 });
  expect(await counts(page)).toEqual({ confirmed: 1, cancelled: 0 });
  expect(errors).toEqual([]);
});

test("the Board's End turn confirm is a panel and ends the turn from its button", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the long-table board's End turn control");
  test.setTimeout(240_000);
  const errors = trackPageErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=board&fixture=abilities");
  await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "the board is up", 120_000);
  await settle(page, { quietMs: 600, maxMs: 5000 });

  await clickFocus(page, "basic:endTurn");
  // The fixture's guide says "Hold on!" first: End turn anyway lets the confirm ask.
  await waitFor(
    async () => ((await activeScenes(page)).includes("HoldOnOverlay") ? true : null),
    "Hold on! opens",
    15_000,
  );
  await clickText(page, "End turn anyway", { sceneKey: "HoldOnOverlay" });
  await waitFor(async () => ((await activeScenes(page)).includes(CONFIRM) ? true : null), "the confirm opens", 15_000);
  await expect(confirmSheet(page)).toBeVisible();
  await expect(confirmSheet(page).locator('[data-key="cancel"]')).toBeVisible();

  await confirmSheet(page).locator('[data-key="ok"]').click();
  await waitFor(
    async () => ((await activeScenes(page)).includes(CONFIRM) ? null : true),
    "the confirm answers",
    10_000,
  );
  await expect(confirmSheet(page)).toHaveCount(0);
  // It ended the turn (not just closed): the villain phase comes up.
  // Ending the turn can raise the fixture's own "Discard any cards?" decision first: it is declined, as a player would.
  await waitFor(
    async () => {
      const scenes = await activeScenes(page);
      if (scenes.includes("VillainPhaseOverlay")) return true;
      if (scenes.includes("ChoiceOverlay"))
        await clickText(page, "Decline", { sceneKey: "ChoiceOverlay", timeoutMs: 3000 }).catch(() => undefined);
      return null;
    },
    "the villain phase follows",
    30_000,
  );
  expect(errors).toEqual([]);
});
