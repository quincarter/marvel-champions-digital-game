import { expect, test, type Page } from "@playwright/test";
import { clickText, isSceneUp, pressUntil, settle, trackPageErrors, waitFor } from "./helpers.js";
import { installWave6Helpers, routeStops, waitForScene } from "./wave6-helpers-a.js";
import { declineMulligans, openApp, startGame, type Rect } from "./wave6-helpers-b.js";

/**
 * After a Card size change the Settings ✕ still closes it, for every size: over a live game from Pause on a desktop,
 * and from Title on a phone (the phone's Pause draws its Table rows inline and has no Settings entry). Each press is
 * aimed at the control's own rect from the scene's focus route (a click on desktop, a tap on the phone), and the
 * effect is read from durable state (the scene gone, the setting saved).
 */

const PAUSE = "PauseOverlay";
const SETTINGS = "SettingsOverlay";
const SIZES = ["large", "xlarge", "same", "standard"] as const;

const isPhone = (info: { project: { name: string } }): boolean => info.project.name === "phone";

async function touchOrClick(page: Page, phone: boolean, x: number, y: number): Promise<void> {
  if (phone) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

const stopOf = async (page: Page, scene: string, key: string): Promise<Rect | null> =>
  (await routeStops(page, scene))?.stops.find((s) => s.key === key)?.rect ?? null;

async function pressStop(
  page: Page,
  phone: boolean,
  scene: string,
  key: string,
  reached: () => Promise<unknown>,
): Promise<void> {
  await pressUntil(
    page,
    async () => {
      const first = await waitFor(() => stopOf(page, scene, key), `control "${key}" on ${scene}`, 10_000);
      await settle(page, { quietMs: 150, maxMs: 500 });
      const rect = (await stopOf(page, scene, key)) ?? first;
      await touchOrClick(page, phone, rect.x + rect.width / 2, rect.y + rect.height / 2);
    },
    reached,
    `${key} on ${scene}`,
  );
}

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

/** Scrolls the Settings body as a player would (wheel, or a swipe) until the Card size cell is on screen. */
async function scrollToCardSize(page: Page, phone: boolean, size: string): Promise<void> {
  const { width, height } = page.viewportSize()!;
  const visible = async (): Promise<boolean> => {
    const rect = await stopOf(page, SETTINGS, `row:card-size:${size}`);
    return rect !== null && rect.y > 100 && rect.y + rect.height < height - 40;
  };
  for (let i = 0; i < 15 && !(await visible()); i++) {
    if (phone) await touchSwipe(page, width / 2, height * 0.7, height * 0.4);
    else {
      await page.mouse.move(width / 2, height / 2);
      await page.mouse.wheel(0, 300);
    }
    await settle(page, { quietMs: 250, maxMs: 1500 });
  }
  expect(await visible(), `the ${size} Card size cell scrolled into view`).toBe(true);
}

const cardSize = (page: Page): Promise<string> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { settings: { cardSize: string } };
    };
    return appSession().settings.cardSize;
  });

/** Picks `size` and closes Settings with its ✕. */
async function pickSizeThenClose(page: Page, phone: boolean, size: string): Promise<void> {
  // Card size is on the Cards tab; Settings reopens on the last tab it showed, so this is a no-op after the first.
  await pressStop(
    page,
    phone,
    SETTINGS,
    "tab:cards",
    async () => (await stopOf(page, SETTINGS, `row:card-size:${size}`)) !== null,
  );
  await scrollToCardSize(page, phone, size);
  await pressStop(page, phone, SETTINGS, `row:card-size:${size}`, async () => (await cardSize(page)) === size);
  await settle(page, { quietMs: 400, maxMs: 3000 });
  await pressStop(page, phone, SETTINGS, "back", async () => !(await isSceneUp(page, SETTINGS)));
}

test("the Settings ✕ closes it after every Card size change", async ({ page }, info) => {
  test.setTimeout(360_000);
  const phone = isPhone(info);
  const errors = trackPageErrors(page);
  await installWave6Helpers(page);

  if (phone) {
    await openApp(page, "");
    for (const size of SIZES) {
      await waitForScene(page, "Title", 30000);
      await settle(page);
      await clickText(page, "SETTINGS", { sceneKey: "Title", until: () => isSceneUp(page, SETTINGS) });
      await settle(page);
      await pickSizeThenClose(page, phone, size);
      expect(await isSceneUp(page, "Title"), `back on Title (${size})`).toBe(true);
    }
  } else {
    await openApp(page);
    await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 3 });
    await declineMulligans(page);
    await settle(page);
    const width = page.viewportSize()!.width;
    for (const size of SIZES) {
      await pressUntil(
        page,
        () => touchOrClick(page, phone, width - 35, 22),
        () => isSceneUp(page, PAUSE),
        "the menu control opens Pause",
      );
      await settle(page);
      await pressStop(page, phone, PAUSE, "settings", () => isSceneUp(page, SETTINGS));
      await pickSizeThenClose(page, phone, size);
      expect(await isSceneUp(page, PAUSE), `Pause is still open under Settings (${size})`).toBe(true);
      await pressStop(page, phone, PAUSE, "resume", async () => !(await isSceneUp(page, PAUSE)));
    }
  }
  expect(errors).toEqual([]);
});
