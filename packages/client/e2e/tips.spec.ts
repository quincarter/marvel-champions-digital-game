import { expect, test } from "@playwright/test";
import {
  clickFocus,
  installPageHelpers,
  pressKey,
  pressUntil,
  rectsOverlap,
  settle,
  trackPageErrors,
  zoneRect,
} from "./helpers.js";
import type { BoardDebug } from "./helpers.js";

/**
 * Opportunistic tips (`docs/guided-mode.md` §4 G10e, §5.3): the `?screen=board&fixture=tips` dev fixture lands on
 * round 2 with a real candidate already queued (`store/dev-tips-game.ts`), so one harmless action (the alter-ego
 * Recover basic power) is enough to trigger a tip deterministically.
 */
test.describe("tips", () => {
  test("a tip shows after one action, clear of the action bar and hand", async ({ page }) => {
    const errors = trackPageErrors(page);
    await installPageHelpers(page);
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "mc-guide",
        JSON.stringify({
          version: 1,
          level: "full",
          chooserSeen: true,
          tutorial: { lessonsDone: [], finished: false, skipped: false },
          aspectLessonsDone: [],
          silencedWarnings: [],
          seenTips: [],
        }),
      );
    });
    await page.goto("/?screen=board&fixture=tips");
    await page.waitForFunction(() => !!(window as unknown as { __mcBoardDebug?: unknown }).__mcBoardDebug, undefined, {
      timeout: 15000,
    });
    await page.waitForFunction(
      () => !!(window as unknown as { __mcBoardDebug?: BoardDebug }).__mcBoardDebug?.zoneRect("actionBar"),
      undefined,
      { timeout: 15000 },
    );

    // The fixture can land mid-villain-phase-walkthrough replay (real behavior — the fixture's own round-1 End
    // turn already ran); dismiss it with Escape if it's showing, same as the tips-live scratchpad check did.
    for (let i = 0; i < 20; i++) {
      const overlayActive = await page.evaluate(
        () =>
          (
            window as unknown as { __mcGame?: { scene: { isActive: (key: string) => boolean } } }
          ).__mcGame?.scene.isActive("VillainPhaseOverlay") ?? false,
      );
      if (!overlayActive) break;
      await pressKey(page, "Escape");
      await settle(page);
    }
    await settle(page);

    const beforeTip = await page.evaluate(
      () => (window as unknown as { __mcBoardDebug?: BoardDebug }).__mcBoardDebug?.tipDisplayed() ?? null,
    );
    expect(beforeTip, "no tip before the player's first action of the turn").toBeNull();

    const tipNow = () =>
      page.evaluate(
        () => (window as unknown as { __mcBoardDebug?: BoardDebug }).__mcBoardDebug?.tipDisplayed() ?? null,
      );
    await pressUntil(page, () => clickFocus(page, "basic:changeForm"), tipNow, "one action raises a tip");
    const afterTip = await tipNow();
    expect(afterTip, "a tip is showing after one action").not.toBeNull();

    const tipRects = await page.evaluate(
      () => (window as unknown as { __mcBoardDebug?: BoardDebug }).__mcBoardDebug?.tipRects() ?? null,
    );
    expect(tipRects, "tip rects are reported").not.toBeNull();

    const actionBar = await zoneRect(page, "actionBar");
    const hand = await zoneRect(page, "hand");
    for (const focusable of tipRects!.focusables) {
      expect(rectsOverlap(focusable, actionBar), "tip does not cover the action bar").toBe(false);
      expect(rectsOverlap(focusable, hand), "tip does not cover the hand").toBe(false);
    }

    expect(errors, `no page errors (${JSON.stringify(errors)})`).toEqual([]);
  });
});
