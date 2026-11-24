import { expect, test, type Page } from "@playwright/test";
import { waitFor } from "./helpers.js";
import { villainDebugRect } from "./overlay-helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";

/**
 * Issue #989: a refresh during the villain phase brought the game back but dropped the walkthrough, with encounter
 * cards still to be flipped and no way to see what resolved. The walkthrough is now noted as open while it is up
 * (`view/villain-phase-resume.ts`) and rebuilt from the save's own commands on a reload, with the table read-only again
 * until the player starts the player phase. Played from the `?screen=villain-decision` jump (a real Rhino/Spider-Man
 * game, auto-advance off, so the phase waits at its START gate), then reloaded on the plain `?game=` address a player's
 * refresh would use. Unit tests: `view/villain-phase-resume.test.ts`.
 */

const boardReadOnly = (page: Page): Promise<boolean | null> =>
  page.evaluate(
    () => (window as unknown as { __mcBoardDebug?: { readOnly(): boolean } }).__mcBoardDebug?.readOnly() ?? null,
  );

/** What a player's address looks like: the dev jump's parameters gone (a dev jump wins over the link on a reload). */
async function dropDevJump(page: Page): Promise<void> {
  await page.evaluate(() => {
    const params = new URLSearchParams(location.search);
    params.delete("screen");
    history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`);
  });
}

test("issue #989: a reload during the villain phase brings the walkthrough back, with the table read-only", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors = trackErrors(page);
  await page.addInitScript(() => {
    // Set once: a reload must not put back a setting the page changed (it changes none, but the marker is not a setting).
    if (localStorage.getItem("mc-settings") === null) {
      localStorage.setItem(
        "mc-settings",
        JSON.stringify({ version: 1, villainAutoAdvance: "off", flipEncounterCards: false, holdEncounterCards: false }),
      );
    }
  });
  await installWave6Helpers(page);
  await page.goto("/?screen=villain-decision");
  await waitFor(() => villainDebugRect(page, "startRect"), "START VILLAIN PHASE", 30_000);
  expect(await boardReadOnly(page), "the table waits while the villain phase is open").toBe(true);
  // The address carries the saved game, the way a player's refresh finds it again.
  await waitFor(
    async () => ((await page.evaluate(() => location.search)).includes("game=") ? true : null),
    "?game=",
    15_000,
  );

  await dropDevJump(page);
  await page.reload();

  // Back on the same walkthrough, at its START gate, and the table still takes no game action.
  await waitFor(() => villainDebugRect(page, "startRect"), "the villain phase back after the reload", 60_000);
  expect(await boardReadOnly(page), "the table is read-only again").toBe(true);
  expect(errors).toEqual([]);
});
