import { expect, test, type Page } from "@playwright/test";
import { settle, waitFor } from "./helpers.js";
import { villainDebugRect } from "./overlay-helpers.js";
import { PAD, installPad, padTap, padWake } from "./pad-e2e-helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";

/**
 * START VILLAIN PHASE by pad (#442): the panel's first draw used to run before its focus route existed, so until
 * something else redrew it the D-pad reached only the top bar's music and bug buttons, and Down from there found no way
 * back to START. A D-pad press the moment the phase opens lands on START, and Down from the bug always gets back to it.
 */

test.use({ viewport: { width: 1920, height: 1080 } });

const SCENE = "VillainPhaseOverlay";

const focusOf = (page: Page): Promise<string | null> =>
  page.evaluate(
    (scene) =>
      (window as unknown as { __mcFocusState?: Record<string, () => { focus: string | null }> }).__mcFocusState?.[
        scene
      ]?.().focus ?? null,
    SCENE,
  );

/** Auto-advance off, so the phase waits on START; and Down held from the first frame the phase is on screen. */
async function openGateWithDownHeld(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      "mc-settings",
      JSON.stringify({ version: 1, villainAutoAdvance: "off", flipEncounterCards: false, holdEncounterCards: false }),
    );
    const w = window as unknown as {
      __fakePad?: { buttons: unknown[] };
      __mcGame?: { scene: { isActive: (key: string) => boolean } };
      __firstRoute?: string[] | null;
    };
    let held = -1;
    const tick = (): void => {
      const pad = w.__fakePad;
      if (pad && held < 0 && w.__mcGame?.scene.isActive("VillainPhaseOverlay")) {
        // What the route offered on the phase's first frame: START has to be there already.
        const routes = (window as unknown as { __mcFocusRoutes?: Record<string, () => { key: string }[]> })
          .__mcFocusRoutes;
        w.__firstRoute = routes?.VillainPhaseOverlay?.().map((stop) => stop.key) ?? null;
        pad.buttons[13] = { pressed: true, touched: true, value: 1 };
        held = 0;
      } else if (pad && held >= 0 && held < 6) {
        held += 1;
        if (held === 6) pad.buttons[13] = { pressed: false, touched: false, value: 0 };
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await installPad(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=villain-interrupt");
  await waitFor(() => villainDebugRect(page, "startRect"), "START VILLAIN PHASE", 30_000);
}

test("a D-pad press as the phase opens lands on START, not the top bar", async ({ page }) => {
  const errors = trackErrors(page);
  await openGateWithDownHeld(page);
  await settle(page, { quietMs: 300, maxMs: 2000 });
  expect(await focusOf(page), "Down held as the phase opened").toBe("start");
  const first = await page.evaluate(() => (window as unknown as { __firstRoute?: string[] | null }).__firstRoute);
  expect(first, "the route on the phase's first frame").toContain("start");
  expect(errors).toEqual([]);
});

test("Down from the top bar's bug always gets back to START", async ({ page }) => {
  const errors = trackErrors(page);
  await openGateWithDownHeld(page);
  await padWake(page);
  await settle(page, { quietMs: 300, maxMs: 2000 });
  // Up to the top bar, then right along it to the bug.
  for (let i = 0; i < 6 && !(await focusOf(page))?.startsWith("chrome:"); i += 1) await padTap(page, PAD.up);
  for (let i = 0; i < 3 && (await focusOf(page)) !== "chrome:report"; i += 1) await padTap(page, PAD.right);
  expect(await focusOf(page), "the bug in the top bar").toBe("chrome:report");
  await page.screenshot({ path: "../../artifacts/qa/villain-gate-pad/bug.png" });

  // Down, and Left where Down runs out, reaches START.
  const seen: (string | null)[] = [];
  for (let i = 0; i < 6 && (await focusOf(page)) !== "start"; i += 1) {
    const before = await focusOf(page);
    await padTap(page, PAD.down);
    if ((await focusOf(page)) === before) await padTap(page, PAD.left);
    seen.push(await focusOf(page));
  }
  expect(await focusOf(page), `the way down: ${seen.join(" > ")}`).toBe("start");
  await page.screenshot({ path: "../../artifacts/qa/villain-gate-pad/start.png" });
  expect(errors).toEqual([]);
});
