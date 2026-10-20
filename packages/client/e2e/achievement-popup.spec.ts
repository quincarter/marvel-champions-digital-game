import { expect, test, type Page } from "@playwright/test";
import { clickText, isSceneUp, settle, trackPageErrors, waitFor } from "./helpers.js";
import { routeStops, waitForScene } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * The "Achievement unlocked" popup (`scenes/achievement-toast.ts`) and its two rows under Settings ▸ More ▸
 * Achievements: picking a position on a real tap saves it and shows a sample there, a swipe of the Settings list that
 * lifts over the row changes nothing (the "no tap on finger lift" rule, issue #227), and a newly earned achievement
 * pops up once.
 */

const SETTINGS = "SettingsOverlay";
const TOAST = "AchievementToast";

interface ToastState {
  readonly showing: { readonly heading: string; readonly title: string; readonly reward: string } | null;
  readonly rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null;
  readonly shown: number;
  readonly place: string;
}

const toastState = (page: Page): Promise<ToastState> =>
  page.evaluate(
    (key) =>
      (
        (window as unknown as { __mcGame: { scene: { getScene(k: string): unknown } } }).__mcGame.scene.getScene(
          key,
        ) as { debugState(): ToastState }
      ).debugState(),
    TOAST,
  );

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

const storedPlace = (page: Page): Promise<string | undefined> =>
  page.evaluate(() => {
    const raw = localStorage.getItem("mc-settings");
    return raw ? (JSON.parse(raw) as { achievementPopupPlace?: string }).achievementPopupPlace : undefined;
  });

async function stopRect(page: Page, key: string): Promise<{ x: number; y: number; width: number; height: number }> {
  return waitFor(
    async () => (await routeStops(page, SETTINGS))?.stops.find((s) => s.key === key)?.rect ?? null,
    `Settings draws ${key}`,
    10000,
  );
}

async function openMoreTab(page: Page, tap: (x: number, y: number) => Promise<void>): Promise<void> {
  await clickText(page, "SETTINGS", { sceneKey: "Title", until: () => isSceneUp(page, SETTINGS) });
  await settle(page);
  const more = await stopRect(page, "tab:more");
  await tap(more.x + more.width / 2, more.y + more.height / 2);
  await settle(page);
}

test("the popup position changes on a tap, never on a swipe's lift, and shows a sample there", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "phone", "the touch release is the phone's case");
  const errors = trackPageErrors(page);
  await openApp(page, "unlock=all");
  await waitForScene(page, "Title", 30000);
  await settle(page);
  await openMoreTab(page, (x, y) => page.touchscreen.tap(x, y));

  const KEY = "row:achievement-popup-place:bottom";
  const row = await stopRect(page, KEY);
  const x = row.x + row.width / 2;
  const y = row.y + row.height / 2;
  await touchSwipe(page, x, Math.min(y + 180, page.viewportSize()!.height - 10), y);
  await settle(page, { quietMs: 400, maxMs: 2000 });
  expect(await storedPlace(page), "a swipe that lifts over Bottom leaves the position alone").toBeUndefined();
  expect((await toastState(page)).shown, "and shows no sample").toBe(0);

  const again = await stopRect(page, KEY);
  await page.touchscreen.tap(again.x + again.width / 2, again.y + again.height / 2);
  await settle(page, { quietMs: 400, maxMs: 2000 });
  expect(await storedPlace(page), "a tap picks Bottom").toBe("bottom");
  const state = await toastState(page);
  expect(state.showing?.title).toBe("Popup preview");
  const viewport = page.viewportSize()!;
  expect(state.rect!.y, "the sample sits along the bottom edge").toBeGreaterThan(viewport.height / 2);

  // Popup size: Large on a tap draws the sample taller than the medium one.
  const large = await stopRect(page, "row:achievement-popup-size:large");
  await page.touchscreen.tap(large.x + large.width / 2, large.y + large.height / 2);
  await settle(page, { quietMs: 400, maxMs: 2000 });
  const larger = await toastState(page);
  expect(larger.rect!.height, "a large sample is taller").toBeGreaterThan(state.rect!.height);
  expect(errors).toEqual([]);
});

test("a newly earned achievement pops up once, in the middle by default", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one size is enough for the announcement itself");
  const errors = trackPageErrors(page);
  // Nothing earned yet, already looked: the next achievement is new.
  await page.addInitScript(() => localStorage.setItem("mc-achievements-seen", "[]"));
  await openApp(page, "unlock=all");
  await waitForScene(page, "Title", 30000);
  await settle(page);
  expect((await toastState(page)).shown).toBe(0);
  await page.evaluate((key) => {
    (
      (window as unknown as { __mcGame: { scene: { getScene(k: string): unknown } } }).__mcGame.scene.getScene(key) as {
        announce(ids: readonly string[]): void;
      }
    ).announce(["wins-1"]);
  }, TOAST);
  const state = await waitFor(
    async () => {
      const s = await toastState(page);
      return s.showing ? s : null;
    },
    "the achievement popup",
    5000,
  );
  expect(state.showing!.heading).toBe("Achievement unlocked");
  const viewport = page.viewportSize()!;
  const middle = state.rect!.y + state.rect!.height / 2;
  expect(Math.abs(middle - viewport.height / 2)).toBeLessThan(4);
  // Gone after its 5 s, and not shown again.
  await waitFor(async () => ((await toastState(page)).showing ? null : true), "the popup goes away", 9000);
  expect((await toastState(page)).shown).toBe(1);
  expect(errors).toEqual([]);
});
