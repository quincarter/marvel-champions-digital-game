import { expect, test, type Page } from "@playwright/test";
import { clickText, isSceneUp, pressAt, pressKey, settle, trackPageErrors, waitFor } from "./helpers.js";
import { routeStops, screens, scrollStopIntoView, waitForScene } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Allow manual adjust (#894) is off until the player turns it on in Settings > More > Misc gameplay, and turning it on
 * warns first. Escape on the warning backs out of the warning only: Settings stays up and the setting stays off.
 */

const SETTINGS = "SettingsOverlay";
const CONFIRM = "EndTurnConfirmOverlay";
const SHOTS = process.env.SHOT_DIR ?? "";

const allowed = (page: Page): Promise<boolean> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { settings: { allowManualAdjust: boolean } };
    };
    return appSession().settings.allowManualAdjust;
  });

async function pressStop(page: Page, key: string): Promise<void> {
  const rect = await waitFor(
    async () => (await routeStops(page, SETTINGS))?.stops.find((s) => s.key === key)?.rect ?? null,
    `Settings draws ${key}`,
    10000,
  );
  await pressAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
  await settle(page, { quietMs: 400, maxMs: 3000 });
}

test("Allow manual adjust warns before it turns on, and Escape on the warning keeps Settings open", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "the keyboard's case");
  const errors = trackPageErrors(page);
  await openApp(page, "unlock=all");
  await waitForScene(page, "Title", 30000);
  await settle(page);
  await clickText(page, "SETTINGS", { sceneKey: "Title", until: () => isSceneUp(page, SETTINGS) });
  await settle(page);
  await pressStop(page, "tab:more");
  await scrollStopIntoView(page, "row:manual-adjust", SETTINGS);
  expect(await allowed(page)).toBe(false);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/settings-misc-gameplay.png` });

  await pressStop(page, "row:manual-adjust");
  await waitForScene(page, CONFIRM);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/manual-adjust-warning.png` });
  await pressKey(page, "Escape");
  await waitFor(async () => ((await screens(page)).includes(CONFIRM) ? null : true), "the warning closes", 8000);
  expect(await screens(page), "Escape closed the warning, not Settings").toContain(SETTINGS);
  expect(await allowed(page)).toBe(false);

  await pressStop(page, "row:manual-adjust");
  await waitForScene(page, CONFIRM);
  const ok = await page.evaluate(
    () =>
      (
        window as unknown as {
          __mcEndTurnConfirmDebug?: { endRect(): { x: number; y: number; width: number; height: number } };
        }
      ).__mcEndTurnConfirmDebug?.endRect() ?? null,
  );
  expect(ok).not.toBeNull();
  await pressAt(page, ok!.x + ok!.width / 2, ok!.y + ok!.height / 2);
  await waitFor(async () => ((await allowed(page)) ? true : null), "Allow manual adjust is on", 8000);
  expect(await screens(page)).toContain(SETTINGS);
  expect(errors).toEqual([]);
});
