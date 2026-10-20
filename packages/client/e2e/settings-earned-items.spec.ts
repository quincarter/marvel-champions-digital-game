import { expect, test, type Page } from "@playwright/test";
import { clickText, isSceneUp, settle, trackPageErrors, waitFor } from "./helpers.js";
import { routeStops, waitForScene } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Settings ▸ More ▸ Earned items (issue #291): the Ultron Drone art row toggles on a real tap, and a swipe of the
 * Settings list that lifts over the row never flips it (the "no tap on finger lift" rule, issue #227).
 */

const SETTINGS = "SettingsOverlay";
const ROW = "row:ultron-drone-art";

/** One finger pressed at (x, fromY), dragged straight to toY in small steps, and lifted there. */
async function touchSwipe(page: Page, x: number, fromY: number, toY: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: fromY }] });
  for (let i = 1; i <= 10; i++) {
    await page.waitForTimeout(16);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: fromY + ((toY - fromY) * i) / 10 }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/** The stored setting: undefined until the player has changed it (it then follows the default, on). */
const storedDroneArt = (page: Page): Promise<boolean | undefined> =>
  page.evaluate(() => {
    const raw = localStorage.getItem("mc-settings");
    return raw ? (JSON.parse(raw) as { ultronDroneArt?: boolean }).ultronDroneArt : undefined;
  });

async function rowRect(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  return waitFor(
    async () => (await routeStops(page, SETTINGS))?.stops.find((s) => s.key === ROW)?.rect ?? null,
    "Settings draws the Ultron Drone art row",
    10000,
  );
}

test("the Drone art row toggles on a tap, never on a swipe's lift", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "the touch release is the phone's case");
  const errors = trackPageErrors(page);
  // "Unlock everything" earns every earned item, so the row is live.
  await openApp(page, "unlock=all");
  await waitForScene(page, "Title", 30000);
  await settle(page);
  await clickText(page, "SETTINGS", { sceneKey: "Title", until: () => isSceneUp(page, SETTINGS) });
  await settle(page);
  const moreTab = (await routeStops(page, SETTINGS))?.stops.find((s) => s.key === "tab:more")?.rect;
  expect(moreTab, "Settings draws a More tab").toBeDefined();
  await page.touchscreen.tap(moreTab!.x + moreTab!.width / 2, moreTab!.y + moreTab!.height / 2);
  await settle(page);

  // The More tab runs past a phone's screen (Achievements sits above Earned items): scroll the row up into view first.
  const viewport = page.viewportSize()!;
  await touchSwipe(page, viewport.width / 2, viewport.height - 120, 220);
  await settle(page, { quietMs: 400, maxMs: 2000 });
  const row = await rowRect(page);
  const x = row.x + row.width / 2;
  const y = row.y + row.height / 2;
  expect(y, "the row is on screen").toBeLessThan(viewport.height - 40);
  await touchSwipe(page, x, Math.min(y + 180, viewport.height - 10), y);
  await settle(page, { quietMs: 400, maxMs: 2000 });
  expect(await storedDroneArt(page), "a swipe that lifts over the row leaves it alone").toBeUndefined();

  const again = await rowRect(page);
  await page.touchscreen.tap(again.x + again.width / 2, again.y + again.height / 2);
  await settle(page, { quietMs: 400, maxMs: 2000 });
  expect(await storedDroneArt(page), "a tap turns the Drone art off").toBe(false);
  expect(errors).toEqual([]);
});
