import { expect, test, type Page } from "@playwright/test";
import {
  clickFocus,
  guideStepId,
  installPageHelpers,
  settle,
  startTutorialFromTitle,
  trackPageErrors,
  waitFor,
} from "./helpers.js";
import { hook } from "./wave6-helpers-b.js";

/**
 * The tutorial's held gate names the taught action, not the characters that action then asks about, so a keyboard or
 * pad has to reach them the same way a tap does (#554): Attack's "who goes first" picker, answered on the card.
 */

const focused = (page: Page): Promise<string | null> => hook<string>(page, "__mcBoardDebug", "focusedKey");

test("Tab and Enter pick Black Cat on the table for the tutorial's attack step", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await installPageHelpers(page);
  await page.goto("/");
  await startTutorialFromTitle(page);
  await waitFor(async () => (await guideStepId(page)) === "play-aunt-may" || null, "lesson 2 opens");

  // Lesson 2's plays and the flip (`TUTORIAL_SCRIPT[1..4]`), through the store the guide watches.
  await page.evaluate(async () => {
    const [{ appSession }, { TUTORIAL_SCRIPT }] = (await Promise.all([
      import("/src/session.ts"),
      import("/src/guide/tutorial-config.ts"),
    ])) as unknown as [
      { appSession: () => { store: { dispatch(command: unknown): Promise<unknown> } } },
      { TUTORIAL_SCRIPT: readonly unknown[] },
    ];
    for (const command of TUTORIAL_SCRIPT.slice(1, 5)) await appSession().store.dispatch(command);
  });
  await waitFor(async () => (await guideStepId(page)) === "attack-with-black-cat" || null, "the attack step");
  await settle(page);

  await clickFocus(page, "basic:attack");
  await settle(page);
  await waitFor(
    async () => {
      if ((await focused(page)) === "card:i4") return true;
      await page.keyboard.press("Tab");
      return null;
    },
    "Tab reaches Black Cat",
    15000,
  );
  await page.keyboard.press("Enter");
  await waitFor(async () => (await guideStepId(page)) === "attack-with-spidey" || null, "Black Cat attacks", 15000);
  expect(errors).toEqual([]);
});
