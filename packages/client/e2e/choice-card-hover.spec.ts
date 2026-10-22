import { expect, test, type Page } from "@playwright/test";
import { activeScenes, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { declineMulligans, openApp, startGame, type Rect } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Issue #149: resting the mouse on a card in a decision sheet opens the card hover popover, as it does on the table.
 * Tigra's Undercover Work raises a decision whose source panel shows her card; the sheet had no popover at all, and the
 * panel never told one where its card was. Setup goes through the store; the hover is a real mouse move.
 */
test.use({ viewport: { width: 1600, height: 900 } });

interface ChoiceHoverDebug {
  hoverRects(): [string, Rect][];
  hoverShown(): string | null;
}

const hoverRects = (page: Page): Promise<[string, Rect][]> =>
  page.evaluate(
    () => (window as unknown as { __mcChoiceDebug?: ChoiceHoverDebug }).__mcChoiceDebug?.hoverRects() ?? [],
  );

const hoverShown = (page: Page): Promise<string | null> =>
  page.evaluate(
    () => (window as unknown as { __mcChoiceDebug?: ChoiceHoverDebug }).__mcChoiceDebug?.hoverShown() ?? null,
  );

test("hovering the source card in a decision sheet opens the card hover popover", async ({ page }, info) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["tigra-aggression"], seed: 5607 });
  await declineMulligans(page);
  await settle(page);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: {
          dispatch: (c: unknown) => Promise<void>;
          state: {
            legal?: { actions: { legal?: { action: { kind: string; abilityId?: string }; example: unknown }[] } };
          };
        };
      };
    };
    const { store } = appSession();
    const work = store.state.legal?.actions.legal?.find(
      (e) => e.action.kind === "useAbility" && e.action.abilityId?.includes("undercover-work"),
    );
    if (work) await store.dispatch(work.example);
  });
  await waitFor(
    async () => ((await activeScenes(page)).includes("ChoiceOverlay") ? true : null),
    "the Undercover Work decision",
    30000,
  );
  await settle(page);

  const rects = await hoverRects(page);
  expect(rects.length, "the sheet registers its cards with the popover").toBeGreaterThan(0);
  // The source panel sits left of the sheet: the leftmost registered card is the source card.
  const [sourceId, source] = [...rects].sort((a, b) => a[1].x - b[1].x)[0]!;
  expect(await hoverShown(page)).toBeNull();

  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.move(source.x + source.width / 2 + 4, source.y + source.height / 2 + 4, { steps: 4 });
  await waitFor(async () => ((await hoverShown(page)) === sourceId ? true : null), "the popover on the source card");
  await page.screenshot({ path: info.outputPath("choice-source-hover.png") });
  if (SHOT) await page.screenshot({ path: `${SHOT}/choice-source-hover.png` });

  // The option cards open it too: the rightmost one.
  const [optionId, option] = [...rects].sort((a, b) => b[1].x - a[1].x)[0]!;
  expect(optionId).not.toBe(sourceId);
  await page.mouse.move(option.x + option.width / 2, option.y + option.height / 2, { steps: 6 });
  await page.mouse.move(option.x + option.width / 2 + 4, option.y + option.height / 2 + 4, { steps: 2 });
  await waitFor(async () => ((await hoverShown(page)) === optionId ? true : null), "the popover on an option card");
  if (SHOT) await page.screenshot({ path: `${SHOT}/choice-option-hover.png` });

  // Off the card, the popover goes.
  await page.mouse.move(8, 8, { steps: 4 });
  await waitFor(async () => ((await hoverShown(page)) === null ? true : null), "the popover closes off the card");

  // Opened again with every picture already loaded, nothing redraws the sheet after its first draw, so that draw's
  // cards are the only ones it has: `create` used to clear them after it (the first draw runs inside its subscribe).
  await page.evaluate(() => {
    const w = window as unknown as {
      __mcChoiceDebug: { stale?: boolean };
      __mcGame: { scene: { getScene: (key: string) => { scene: { restart: () => void } } } };
    };
    // Each `create` sets a fresh debug hook, so the marked one going is the new sheet having run its `create`.
    w.__mcChoiceDebug.stale = true;
    w.__mcGame.scene.getScene("ChoiceOverlay").scene.restart();
  });
  await waitFor(
    () =>
      page.evaluate(() =>
        (window as unknown as { __mcChoiceDebug?: { stale?: boolean } }).__mcChoiceDebug?.stale ? null : true,
      ),
    "the reopened decision",
    30000,
  );
  await settle(page);
  expect((await hoverRects(page)).length, "a reopened sheet registers its cards").toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
