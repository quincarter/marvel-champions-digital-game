import { expect, test, type Page } from "@playwright/test";
import {
  activeScenes,
  clickFocus,
  clickText,
  guideStepId,
  pressAt,
  pressEndTurn,
  settle,
  trackPageErrors,
  waitFor,
} from "./helpers.js";
import {
  answerChoice,
  clickBoxPageRow,
  findVisibleText,
  openApp,
  openBoxPage,
  useIdentityAbility,
} from "./wave6-helpers-b.js";
import { skipVillainPhase } from "./wave6-helpers-a.js";

/**
 * The wave 9 Try-it lessons (guided mode §3.14), one played through the real screens: Silk's "tucked cards" lesson from
 * How to play → New in Agents of S.H.I.E.L.D. to its completion panel. Every lesson's full playthrough is Vitest's job
 * (`guide/mechanic-lessons.test.ts`); this is the one that proves the cycle 9 page launches a lesson and that the
 * board's own prompts (the hand-size discard, the villain phase, the defender question, Silk Sense's offer) carry a
 * player through it.
 */

const on = async (page: Page, key: string): Promise<boolean> => (await activeScenes(page)).includes(key);
const stepIs = (page: Page, id: string) => async (): Promise<true | null> =>
  (await guideStepId(page)) === id ? true : null;

/** Answers whatever the villain phase asks (discard, defender, a Response offer) until the guide reaches `id`. */
async function playUntilStep(page: Page, id: string): Promise<void> {
  await waitFor(
    async () => {
      if ((await guideStepId(page)) === id) return true;
      // Silk Sense is offered as a response window on the docked villain phase's rail (its USE button, read from the
      // phase's own debug hook): take it, never skip past it. The decision sheet waits inert underneath.
      const use = await page.evaluate(
        () =>
          (
            window as unknown as {
              __mcVillainPhaseDebug?: {
                useRect?: () => { x: number; y: number; width: number; height: number } | null;
              };
            }
          ).__mcVillainPhaseDebug?.useRect?.() ?? null,
      );
      if (use) await pressAt(page, use.x + use.width / 2, use.y + use.height / 2);
      else if (await on(page, "ChoiceOverlay")) await answerChoice(page, 0);
      else if (await on(page, "VillainPhaseOverlay")) await skipVillainPhase(page);
      await settle(page, { quietMs: 250, maxMs: 1500 });
      return null;
    },
    `the guide reaches ${id}`,
    90000,
  );
}

test("Silk: tucked cards plays from the Agents of S.H.I.E.L.D. page to its completion panel", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackPageErrors(page);
  await openApp(page);
  await clickText(page, "How to play");
  await waitFor(async () => ((await on(page, "HowToPlay")) ? true : null), "How to play opens", 8000);
  await settle(page);
  await openBoxPage(page, "New in Agents of S.H.I.E.L.D.");
  await clickBoxPageRow(page, "silk");
  await waitFor(async () => ((await on(page, "Board")) ? true : null), "the lesson's Board", 20000);
  await waitFor(stepIs(page, "intro"), "the intro step", 20000);
  await settle(page);

  await clickText(page, "Got it", { sceneKey: "Board" });
  await waitFor(stepIs(page, "flip"), "the flip step", 8000);
  await clickFocus(page, "basic:changeForm");
  await waitFor(stepIs(page, "tuck"), "the tuck step", 8000);

  await settle(page);
  await pressEndTurn(page);
  await playUntilStep(page, "flip-back");

  await clickFocus(page, "basic:changeForm");
  await waitFor(stepIs(page, "cindy-moon"), "the Cindy Moon step", 8000);
  await settle(page);
  await useIdentityAbility(page, "Cindy Moon");
  await waitFor(stepIs(page, "result"), "the result step", 15000);
  await settle(page);
  await clickText(page, "Got it", { sceneKey: "Board" });
  await waitFor(
    async () => ((await findVisibleText(page, "Try it complete", "Board")).length > 0 ? true : null),
    "the completion panel",
    8000,
  );
  expect(errors).toEqual([]);
});
