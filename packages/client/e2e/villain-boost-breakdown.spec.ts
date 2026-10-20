import { expect, test, type Page } from "@playwright/test";
import { settle, waitFor } from "./helpers.js";
import { villainDebugRect } from "./overlay-helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import type { Rect } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Issue #285: on a phone, once the villain's attack had resolved, "happening now" drew the boost card over the damage
 * breakdown and cut the total off: the headline wrapped to two lines and the panel's fixed height had no room left.
 * Played from the `?screen=villain-boost-interrupt` jump (Scarlet Witch against Rhino, paused on Chaos Control's
 * boost-count window), answered with RESOLVE so the attack resolves: seed 1 counts Crowd Control, a side scheme drawn
 * on its side, and seed 4 counts "I'm Tough!", a portrait card. The viewport is a 360-wide phone, where the headline
 * wraps. Phone only: the desktop rail lays out "happening now" on its own, taller body.
 */

// The resolved attack is one beat of the walkthrough, which reduced motion (the suite's default) skips past.
test.use({ reducedMotion: "no-preference" });

interface BoostedBeat {
  readonly text: string;
  readonly breakdown: Rect;
  readonly cut: boolean;
  readonly boosts: Rect[];
  readonly body: Rect;
}

/** The last "happening now" the panel drew with a breakdown and boost cards (kept: the beat may already have passed). */
const boostedBeat = (page: Page): Promise<BoostedBeat | null> =>
  page.evaluate(
    () =>
      (
        window as unknown as { __mcVillainPhaseDebug?: { boostedBeat?: () => BoostedBeat | null } }
      ).__mcVillainPhaseDebug?.boostedBeat?.() ?? null,
  );

const tap = async (page: Page, rect: Rect): Promise<void> => {
  // A control drawn this frame takes presses from the next one: let the screen settle first.
  await settle(page);
  await page.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await settle(page);
};

for (const [seed, shape] of [
  [1, "landscape"],
  [4, "portrait"],
] as const) {
  test(`issue #285: a ${shape} boost card sits under the damage breakdown, which shows the total`, async ({
    page,
  }, info) => {
    test.setTimeout(120_000);
    test.skip(info.project.name !== "phone", "the bug is the phone's docked panel");
    await page.setViewportSize({ width: 360, height: 800 });
    const errors = trackErrors(page);
    await page.addInitScript(() =>
      localStorage.setItem("mc-settings", JSON.stringify({ version: 1, villainAutoAdvance: "off" })),
    );
    await installWave6Helpers(page);
    await page.goto(`/?screen=villain-boost-interrupt&seed=${seed}`);
    await tap(page, await waitFor(() => villainDebugRect(page, "startRect"), "START VILLAIN PHASE", 30_000));
    await waitFor(() => villainDebugRect(page, "resolveRect"), "the boost window", 30_000);
    // With motion on the window can still be sliding in when it is first drawn: RESOLVE until it has closed.
    await waitFor(
      async () => {
        const resolve = await villainDebugRect(page, "resolveRect");
        if (!resolve) return true;
        await tap(page, resolve);
        await page.waitForTimeout(500);
        return null;
      },
      "the boost window answered",
      20_000,
    );

    // The resolved attack: its breakdown ends on the total ("… = DAMAGE 2").
    const { breakdown, cut, boosts, body } = await waitFor(
      async () => {
        const beat = await boostedBeat(page);
        return beat && /=/.test(beat.text) ? beat : null;
      },
      "the attack's breakdown and its boost card",
      15_000,
    );
    if (SHOT) await page.screenshot({ path: `${SHOT}/villain-boost-breakdown-${shape}-phone.png` });

    for (const rect of boosts) {
      expect(rect.y, "the boost card under the breakdown").toBeGreaterThanOrEqual(breakdown.y + breakdown.height);
      expect(rect.y + rect.height, "the boost card inside happening now").toBeLessThanOrEqual(body.y + body.height + 1);
    }
    expect(cut, "the breakdown shown whole, the total with it").toBe(false);
    expect(errors).toEqual([]);
  });
}
