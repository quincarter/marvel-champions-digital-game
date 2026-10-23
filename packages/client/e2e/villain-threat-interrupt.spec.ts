import { expect, test } from "@playwright/test";
import { pressAt, settle, waitFor } from "./helpers.js";
import { villainDebugRect } from "./overlay-helpers.js";
import { installWave6Helpers, trackErrors, visibleTexts } from "./wave6-helpers-a.js";

/**
 * Issue #371 (reported by @zackburnley): Great Responsibility's interrupt window at villain step one said only
 * "Auto-advance paused for your interrupt", not how much threat was about to go on which scheme. Played from the
 * `?screen=villain-threat-interrupt` jump: a real Rhino game paused on that window.
 */
test("Great Responsibility's window says how much threat is about to go on which scheme", async ({ page }, info) => {
  test.setTimeout(120_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      "mc-settings",
      JSON.stringify({ version: 1, villainAutoAdvance: "off", flipEncounterCards: false, holdEncounterCards: false }),
    ),
  );
  await installWave6Helpers(page);
  await page.goto("/?screen=villain-threat-interrupt");

  const start = await waitFor(() => villainDebugRect(page, "startRect"), "START VILLAIN PHASE", 30_000);
  await settle(page);
  if (phone) await page.touchscreen.tap(start.x + start.width / 2, start.y + start.height / 2);
  else await pressAt(page, start.x + start.width / 2, start.y + start.height / 2);
  await waitFor(() => villainDebugRect(page, "resolveRect"), "the interrupt window", 15_000);
  await settle(page);

  const caption = await waitFor(
    async () => (await visibleTexts(page)).find((t) => /is about to get 1 threat/.test(t.text)) ?? null,
    "the caption naming the threat",
    10_000,
  );
  expect(caption.text).toMatch(/^The Break-In! is about to get 1 threat$/);
  expect((await visibleTexts(page)).some((t) => t.text.includes("Auto-advance paused for your interrupt"))).toBe(false);
  await page.screenshot({ path: `test-results/villain-threat-interrupt-${info.project.name}.png` });
  expect(errors).toEqual([]);
});
