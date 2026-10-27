import { expect, test, type Page } from "@playwright/test";
import { settle } from "./helpers.js";
import {
  clickStop,
  installWave6Helpers,
  routeStops,
  trackErrors,
  visibleTexts,
  waitForScene,
} from "./wave6-helpers-a.js";

/**
 * Issue #448: after a won campaign issue, the Aftermath's reward columns ran past the action bar on a phone with no
 * way to scroll, so only the first hero could take a reward. The columns now scroll (a swipe on a phone, the wheel
 * on a desktop), a swipe never picks the row it lifts over, and the last hero's reward can be taken and confirmed.
 * The run is the `seedDesignWon("fresh")` QA fixture: TRoRS issue 1 (Crossbones) composed and won, not folded.
 */

interface Stop {
  readonly key: string;
  readonly rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

const SCENE = "CampaignAftermath";
const stopsOf = async (page: Page): Promise<Stop[]> => (await routeStops(page, SCENE))?.stops ?? [];
const texts = async (page: Page): Promise<string[]> =>
  (await visibleTexts(page)).filter((text) => text.scene === SCENE).map((text) => text.text);

/** A finger drag from (x, y0) to (x, y1), as a real touch sequence that rests before lifting. */
async function swipe(page: Page, x: number, y0: number, y1: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const point = (y: number): { x: number; y: number; id: number } => ({ x, y, id: 1 });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(y0)] });
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [point(y0 + ((y1 - y0) * i) / steps)],
    });
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(150);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

async function scrollBy(page: Page, isMobile: boolean, x: number, dy: number): Promise<void> {
  const middle = page.viewportSize()!.height / 2;
  if (isMobile) await swipe(page, x, middle + dy / 2, middle - dy / 2);
  else {
    await page.mouse.move(x, middle);
    await page.mouse.wheel(0, dy);
  }
  await settle(page, { quietMs: 200, maxMs: 1200 });
}

/** Scrolls until the stop sits wholly above the action bar (a control takes a tap only while wholly in view). */
async function scrollTo(page: Page, isMobile: boolean, key: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const stops = await stopsOf(page);
    const target = stops.find((stop) => stop.key === key);
    expect(target, `${key} is on the Aftermath`).toBeTruthy();
    const bar = stops.find((stop) => stop.key === "commit")!.rect;
    const { rect } = target!;
    const top = 70;
    const bottom = bar.y - 24;
    if (rect.y >= top && rect.y + rect.height <= bottom) return;
    const wanted = rect.y < top ? rect.y - top - 8 : rect.y + rect.height - bottom + 8;
    const step = Math.sign(wanted) * Math.min(page.viewportSize()!.height * 0.3, Math.max(30, Math.abs(wanted)));
    await scrollBy(page, isMobile, rect.x + rect.width / 2, step);
  }
  throw new Error(`the Aftermath never scrolled ${key} into view`);
}

async function openAftermath(page: Page): Promise<string[]> {
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?unlock=all");
  await waitForScene(page, "Title");
  const runId = await page.evaluate(async () => {
    const handle = (window as unknown as { __mcCampaign: { seedDesignWon(stop: string): Promise<{ runId: string }> } })
      .__mcCampaign;
    return (await handle.seedDesignWon("fresh")).runId;
  });
  await page.evaluate((id) => {
    const game = (window as unknown as { __mcGame: any }).__mcGame;
    for (const scene of game.scene.getScenes(true))
      if (scene.sys.settings.key !== "MusicScene") game.scene.stop(scene.sys.settings.key);
    game.scene.start("CampaignAftermath", { runId: id });
  }, runId);
  await waitForScene(page, SCENE, 40_000);
  await expect
    .poll(async () => (await stopsOf(page)).some((stop) => stop.key.startsWith("pick:")), { timeout: 60_000 })
    .toBe(true);
  await settle(page, { quietMs: 400, maxMs: 3000 });
  return errors;
}

/** The pick stops of one seat, in the order drawn. */
const picksOf = async (page: Page, seat: number): Promise<Stop[]> =>
  (await stopsOf(page)).filter((stop) => stop.key.startsWith(`pick:${seat}:`));

test("every hero's reward can be reached, taken and confirmed", async ({ page, isMobile }) => {
  test.setTimeout(240_000);
  const errors = await openAftermath(page);
  const first = (await picksOf(page, 1))[0]!;
  const last = (await picksOf(page, 2)).at(-1)!;
  if (isMobile) {
    const bar = (await stopsOf(page)).find((stop) => stop.key === "commit")!.rect;
    expect(last.rect.y, "the second hero's last reward starts below the action bar").toBeGreaterThan(bar.y);
  }
  await scrollTo(page, isMobile, last.key);
  await clickStop(page, last.key, SCENE);
  await scrollTo(page, isMobile, first.key);
  await clickStop(page, first.key, SCENE);
  await settle(page, { quietMs: 300, maxMs: 1500 });
  expect((await texts(page)).filter((text) => text === "YOURS")).toHaveLength(2);
  await clickStop(page, "commit", SCENE);
  await expect.poll(async () => (await stopsOf(page)).some((stop) => stop.key === "next-issue")).toBe(true);
  const dir = process.env.E2E_SHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/campaign-aftermath-scroll-${isMobile ? "phone" : "desktop"}.png` });
  expect(errors).toEqual([]);
});

test("a swipe over the rewards never picks the row it lifts over", async ({ page, isMobile }) => {
  test.skip(!isMobile, "a touch swipe");
  test.setTimeout(180_000);
  const errors = await openAftermath(page);
  const [, pressed, below] = await picksOf(page, 1);
  // Press on a reward and drag up one row, lifting over a reward: the press and the lift are both on real rows, so the
  // region's drag suppression is all that keeps a pick from firing.
  const x = pressed!.rect.x + pressed!.rect.width / 2;
  const step = below!.rect.y - pressed!.rect.y;
  await swipe(page, x, pressed!.rect.y + pressed!.rect.height / 2, pressed!.rect.y + pressed!.rect.height / 2 - step);
  await settle(page, { quietMs: 300, maxMs: 1500 });
  const after = (await picksOf(page, 1)).find((stop) => stop.key === pressed!.key)!;
  expect(after.rect.y, "the swipe scrolled the columns").toBeLessThan(pressed!.rect.y - 20);
  expect(await texts(page), "the swipe picked nothing").not.toContain("YOURS");
  expect(errors).toEqual([]);
});
