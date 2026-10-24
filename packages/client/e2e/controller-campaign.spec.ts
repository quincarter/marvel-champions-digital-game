import { expect, test, type Page } from "@playwright/test";
import { activeScenes, findText, trackPageErrors, waitFor } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * The campaign screens answer a controller (owner request: hotkeys for every campaign situation):
 * - The Market: LB / RB step the price tiers, Y reads the focused card, A adds it, B takes the cart back and then
 *   leaves, X filters to what the seat can afford, Start finishes shopping.
 * - The opener's comic: Start skips the whole sequence.
 */

const PAD_ID = "Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)";
const A = 0;
const B = 1;
const X = 2;
const Y = 3;
const LB = 4;
const RB = 5;
const LT = 6;
const START = 9;
const DOWN = 13;

async function installPad(page: Page): Promise<void> {
  await page.addInitScript((id) => {
    const button = () => ({ pressed: false, touched: false, value: 0 });
    const pad = {
      connected: true,
      id,
      index: 0,
      mapping: "standard",
      timestamp: 0,
      buttons: Array.from({ length: 17 }, button),
      axes: [0, 0, 0, 0],
    };
    (window as unknown as { __fakePad: unknown }).__fakePad = pad;
    Object.defineProperty(navigator, "getGamepads", {
      value: () => {
        pad.timestamp = performance.now();
        return [pad];
      },
      configurable: true,
    });
  }, PAD_ID);
}

async function setButton(page: Page, index: number, on: boolean): Promise<void> {
  await page.evaluate(
    ([i, down]) => {
      const pad = (window as unknown as { __fakePad: { buttons: unknown[] } }).__fakePad;
      pad.buttons[i as number] = { pressed: down, touched: down, value: down ? 1 : 0 };
    },
    [index, on] as const,
  );
}

/** Holds a button until `done` (the pad is read once a frame), then lets go. */
async function press(page: Page, index: number, done?: () => Promise<boolean>): Promise<void> {
  await setButton(page, index, true);
  if (!done) await page.waitForTimeout(400);
  else {
    for (let i = 0; i < 30; i += 1) {
      await page.waitForTimeout(100);
      if (await done()) break;
    }
  }
  await setButton(page, index, false);
  await page.waitForTimeout(300);
}

test.use({ viewport: { width: 1280, height: 800 } });

const sceneIs = (page: Page, key: string) => async () => (await activeScenes(page)).includes(key);
const sceneGone = (page: Page, key: string) => async () => !(await activeScenes(page)).includes(key);
const hasText = (page: Page, text: string, scene: string) => async () => (await findText(page, text, scene)).length > 0;

const focusOf = (page: Page, scene: string): Promise<string | null> =>
  page.evaluate(
    (key) =>
      (window as unknown as { __mcFocusState?: Record<string, () => { focus: string | null }> }).__mcFocusState?.[
        key
      ]?.().focus ?? null,
    scene,
  );

async function openScreen(page: Page, query: string, landing: string): Promise<void> {
  await installPad(page);
  await openApp(page, query, { landing });
  // The left trigger does nothing alone: it wakes the pad plugin without moving focus.
  await press(page, LT);
}

test("the Market: LB/RB tiers, Y inspects, A buys, B takes the cart back then leaves, Start finishes", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = trackPageErrors(page);
  await openScreen(page, "screen=campaign-market&units=20", "CampaignMarket");
  await waitFor(hasText(page, "EMPTY", "CampaignMarket"), "the Market is stocked", 60_000);
  expect(await focusOf(page, "CampaignMarket")).toBeNull();
  // The pad toast covers the first moments after the pad wakes.
  await page.waitForTimeout(1500);

  // RB steps to the next price tier and lands on its first card.
  await press(page, RB, async () => ((await focusOf(page, "CampaignMarket")) ?? "").startsWith("cart:"));
  const first = await focusOf(page, "CampaignMarket");
  expect(first, "RB focuses a shelf card").toMatch(/^cart:/);
  await page.waitForTimeout(500);
  await shot(page, "market-desktop-focus");
  await press(page, RB, async () => (await focusOf(page, "CampaignMarket")) !== first);
  const second = await focusOf(page, "CampaignMarket");
  expect(second).not.toBe(first);
  await press(page, LB, async () => (await focusOf(page, "CampaignMarket")) !== second);
  expect(await focusOf(page, "CampaignMarket"), "LB steps back a tier").toBe(first);

  // Y reads the card; B closes the sheet and the Market is still there.
  await press(page, Y, sceneIs(page, "InspectOverlay"));
  expect(await sceneIs(page, "InspectOverlay")()).toBe(true);
  await press(page, B, sceneGone(page, "InspectOverlay"));
  expect(await sceneIs(page, "InspectOverlay")()).toBe(false);
  expect(await sceneIs(page, "CampaignMarket")()).toBe(true);

  // A adds the card to the cart.
  await press(page, A, hasText(page, "IN YOUR CART", "CampaignMarket"));
  await shot(page, "market-desktop-cart");
  expect((await findText(page, "IN YOUR CART", "CampaignMarket")).length).toBeGreaterThan(0);
  expect(await hasText(page, "EMPTY", "CampaignMarket")()).toBe(false);

  // B takes the pending purchase back first, and only then leaves.
  await press(page, B, hasText(page, "EMPTY", "CampaignMarket"));
  expect(await hasText(page, "EMPTY", "CampaignMarket")()).toBe(true);
  expect(await sceneIs(page, "CampaignMarket")()).toBe(true);

  // X shows only what the seat can afford (everything, at 20 units: the toggle must not break the shelf).
  await press(page, X);
  expect(await sceneIs(page, "CampaignMarket")()).toBe(true);
  await press(page, X);

  // Start finishes shopping.
  await press(page, START, sceneGone(page, "CampaignMarket"));
  await waitFor(sceneGone(page, "CampaignMarket"), "Start leaves the Market", 30_000);
  expect(errors).toEqual([]);
});

const SHOTS = process.env.PAD_CAMPAIGN_SHOTS ?? "";
const shot = async (page: Page, name: string): Promise<void> => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/pad-campaign-${name}.png` });
};

const stopKeys = (page: Page, scene: string): Promise<string[]> =>
  page.evaluate(
    (key) =>
      (window as unknown as { __mcFocusRoutes: Record<string, () => { key: string }[]> }).__mcFocusRoutes[key]!().map(
        (stop) => stop.key,
      ),
    scene,
  );

test("the Dossier: RB and LB step the tabs", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openScreen(page, "screen=shadowland-dossier&unlock=all", "CampaignDossier");
  await waitFor(hasText(page, "OVERVIEW", "CampaignDossier"), "the Dossier is drawn", 30_000);
  // The pad toast covers the first moments after the pad wakes.
  await page.waitForTimeout(1500);
  await shot(page, "dossier-overview");
  expect((await stopKeys(page, "CampaignDossier")).filter((key) => key.startsWith("tab:"))).toHaveLength(4);
  await press(page, RB, hasText(page, "WON · 1st try", "CampaignDossier"));
  expect(await hasText(page, "WON · 1st try", "CampaignDossier")(), "RB opens the Log").toBe(true);
  await shot(page, "dossier-log");
  const inLog = hasText(page, "WON · 1st try", "CampaignDossier");
  // RB steps on to Heroes; LB comes back to the Log, and one more LB to the Overview.
  await press(page, RB, async () => !(await inLog()));
  expect(await inLog(), "RB leaves the Log").toBe(false);
  await press(page, LB, inLog);
  expect(await inLog(), "LB steps back to the Log").toBe(true);
  await page.waitForTimeout(700);
  await press(page, LB, hasText(page, "THE WORLD", "CampaignDossier"));
  expect(await hasText(page, "THE WORLD", "CampaignDossier")(), "LB steps back to the Overview").toBe(true);
  expect(errors).toEqual([]);
});

test("the Briefing: a call is answered with the pad", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openScreen(page, "screen=fne-briefing&unlock=all", "CampaignBriefing");
  await waitFor(
    async () => ((await stopKeys(page, "CampaignBriefing")).includes("call-option:0") ? true : null),
    "the first call is on the Briefing",
    30_000,
  );
  await page.waitForTimeout(1500);
  await shot(page, "briefing-call");
  // The D-pad walks to the first answer; A takes it.
  for (let step = 0; step < 6 && (await focusOf(page, "CampaignBriefing")) !== "call-option:0"; step += 1) {
    await press(page, DOWN);
  }
  expect(await focusOf(page, "CampaignBriefing")).toBe("call-option:0");
  const options = async (): Promise<number> =>
    (await stopKeys(page, "CampaignBriefing")).filter((key) => key.startsWith("call-option:")).length;
  expect(await options(), "the first call has two answers").toBe(2);
  await press(page, A, async () => (await options()) !== 2);
  expect(await options(), "answering the first call brings the next question").not.toBe(2);
  await shot(page, "briefing-answered");
  expect(errors).toEqual([]);
});

test("the opener: Start skips the whole sequence", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openScreen(
    page,
    "screen=campaign-opener&campaign=shadowland&node=shadows-in-the-night&unlock=all",
    "CampaignOpener",
  );
  await waitFor(
    async () => ((await stopKeys(page, "CampaignOpener")).includes("skip") ? true : null),
    "the opener is drawn",
    30_000,
  );
  await page.waitForTimeout(1500);
  await shot(page, "opener");
  await press(page, START, sceneGone(page, "CampaignOpener"));
  await waitFor(sceneGone(page, "CampaignOpener"), "Start leaves the opener", 30_000);
  expect(errors).toEqual([]);
});

test.describe("a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the Market answers the pad: tier, inspect, add, take back", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = trackPageErrors(page);
    await openScreen(page, "screen=campaign-market&units=20", "CampaignMarket");
    await waitFor(hasText(page, "EMPTY", "CampaignMarket"), "the Market is stocked", 60_000);
    await page.waitForTimeout(1500);
    await press(page, RB, async () => ((await focusOf(page, "CampaignMarket")) ?? "").startsWith("cart:"));
    await shot(page, "market-phone-focus");
    await press(page, Y, sceneIs(page, "InspectOverlay"));
    expect(await sceneIs(page, "InspectOverlay")()).toBe(true);
    await press(page, B, sceneGone(page, "InspectOverlay"));
    await press(page, A, hasText(page, "IN YOUR CART", "CampaignMarket"));
    await shot(page, "market-phone-cart");
    await press(page, B, hasText(page, "EMPTY", "CampaignMarket"));
    expect(await hasText(page, "EMPTY", "CampaignMarket")()).toBe(true);
    expect(errors).toEqual([]);
  });
});
