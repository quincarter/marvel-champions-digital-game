import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, findText, settle, trackPageErrors, waitFor } from "./helpers.js";
import { clickStop, hasStop, installWave6Helpers, seatDeckThroughTile, waitForScene } from "./wave6-helpers-a.js";
import { declineMulligans, hook, openApp, startGame } from "./wave6-helpers-b.js";

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
const VIEW = 8;
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

  // Buy a card again, and Start finishes shopping: the Market hands the card to the Briefing.
  await press(page, A, hasText(page, "IN YOUR CART", "CampaignMarket"));
  const receipt = (await findText(page, "Groot · ", "CampaignMarket")).map((match) => match.text);
  const bought = receipt.map((text) => text.replace(/^Groot · /, "")).find((text) => text.length > 2);
  expect(bought, "the receipt names the card in the cart").toBeTruthy();
  // Start checks out Groot and hands the shelf to Rocket; a second Start (an empty cart) finishes the visit.
  await press(page, START, hasText(page, "ROCKET RACCOON'S CART", "CampaignMarket"));
  expect(await hasText(page, "ROCKET RACCOON'S CART", "CampaignMarket")(), "the shelf moved to the next seat").toBe(
    true,
  );
  for (let attempt = 0; attempt < 4 && !(await sceneIs(page, "CampaignBriefing")()); attempt += 1) {
    await page.waitForTimeout(1200);
    await press(page, START, sceneIs(page, "CampaignBriefing"));
  }
  await waitFor(sceneIs(page, "CampaignBriefing"), "Start leaves the Market for the Briefing", 30_000);
  expect(await sceneIs(page, "CampaignMarket")()).toBe(false);
  await waitFor(
    async () => ((await findText(page, bought!, "CampaignBriefing")).length > 0 ? true : null),
    "the bought card is in the Briefing deck",
    30_000,
  );
  expect(errors).toEqual([]);
});

const SHOTS = process.env.PAD_CAMPAIGN_SHOTS ?? "";
const shot = async (page: Page, name: string): Promise<void> => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/pad-campaign-${name}.png` });
};

/** Tabs the focus ring (keyboard, same route as the pad) until it rests on `key`. */
async function focusStop(page: Page, scene: string, key: string): Promise<void> {
  for (let step = 0; step < 40; step += 1) {
    if ((await focusOf(page, scene)) === key) return;
    await page.keyboard.press("Tab");
    await page.waitForTimeout(80);
  }
  throw new Error(`never focused ${key} on ${scene}`);
}

const SHEET = "NameConflictOverlay";

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
  for (let attempt = 0; attempt < 3 && !(await hasText(page, "THE WORLD", "CampaignDossier")()); attempt += 1) {
    await press(page, LB, hasText(page, "THE WORLD", "CampaignDossier"));
    await page.waitForTimeout(500);
  }
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

test("the Replace sheet: A on the chosen row and Start both confirm, without walking down to Replace", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors = trackPageErrors(page);
  await installPad(page);
  await installWave6Helpers(page);
  await openApp(page, "unlock=all", { landing: "Title" });
  await waitForScene(page, "Title", 30000);
  await settle(page);
  await clickText(page, "NEW GAME", { sceneKey: "Title" });
  await waitForScene(page, "ScenarioSelect");
  await waitFor(async () => (await hasStop(page, "next", "ScenarioSelect")) || null, "scenario list", 15000);
  await clickStop(page, "scenario:rhino", "ScenarioSelect");
  await settle(page);
  await clickStop(page, "next", "ScenarioSelect");
  await waitForScene(page, "Seats");
  await waitFor(async () => (await hasStop(page, "hero-search", "Seats")) || null, "hero search", 10000);
  for (const [name, deck] of [
    ["Colossus", "colossus-protection"],
    ["Shadowcat", "shadowcat-aggression"],
  ] as const) {
    await seatDeckThroughTile(page, `precon:${deck}`, { search: name });
    await settle(page);
  }
  await clickStop(page, "play", "Seats");
  await waitForScene(page, SHEET);
  await settle(page);
  await press(page, LT);
  await page.waitForTimeout(1500);
  const statusOf = async (index: number): Promise<string | undefined> =>
    (await hook<{ status: string }[]>(page, "__mcNameConflictDebug", "entries"))?.[index]?.status;
  const selected = (): Promise<string | null> => hook<string | null>(page, "__mcNameConflictDebug", "selected");

  // Start confirms the recommended (already chosen) replacement.
  await focusStop(page, SHEET, "replace:0");
  await press(page, A, async () => (await selected()) !== null);
  const recommended = await selected();
  expect(recommended, "the picker opens with a card chosen").toBeTruthy();
  await shot(page, "replace-sheet-start-hint");
  await press(page, START, async () => (await statusOf(0)) === "replaced");
  expect(await statusOf(0), "Start replaced the card").toBe("replaced");

  // A card other than the recommended one: A chooses it, a second A on the same row confirms.
  await focusStop(page, SHEET, "replace:1");
  await press(page, A, async () => (await selected()) !== null);
  let other = "";
  for (let step = 0; step < 30 && !other; step += 1) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(80);
    const key = (await focusOf(page, SHEET)) ?? "";
    if (key.startsWith("pick:") && key !== `pick:${await selected()}`) other = key;
  }
  expect(other, "the focus reached another candidate").toBeTruthy();
  await press(page, A, async () => `pick:${await selected()}` === other);
  expect(`pick:${await selected()}`, "A chose the focused row").toBe(other);
  // A second press right on the first can be read as one: let it settle, and press again if it did not land.
  for (let presses = 0; presses < 3 && (await statusOf(1)) !== "replaced"; presses += 1) {
    await page.waitForTimeout(800);
    await press(page, A, async () => (await statusOf(1)) === "replaced");
  }
  expect(await statusOf(1), "A on the chosen row confirmed it").toBe("replaced");
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

  test("a swipe that lifts over a card does not add it, and Start closes the open receipt", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = trackPageErrors(page);
    await openScreen(page, "screen=campaign-market&units=20", "CampaignMarket");
    await waitFor(hasText(page, "EMPTY", "CampaignMarket"), "the Market is stocked", 60_000);
    await page.waitForTimeout(1500);
    type Rect = { x: number; y: number; width: number; height: number };
    const routes = (): Promise<{ key: string; rect: Rect }[]> =>
      page.evaluate(() =>
        (window as unknown as { __mcFocusRoutes: Record<string, () => { key: string; rect: Rect }[]> }).__mcFocusRoutes
          .CampaignMarket!(),
      );
    const first = (await routes()).find(
      (stop) => stop.key.startsWith("cart:") && stop.rect.y > 200 && stop.rect.y < 600,
    )!;
    expect(first, "a shelf card is on screen").toBeTruthy();
    // A finger drag that starts on a card and lifts over another: a scroll, never a press.
    const cdp = await page.context().newCDPSession(page);
    const x = first.rect.x + first.rect.width / 2;
    const y0 = first.rect.y + first.rect.height / 2;
    const point = (y: number) => ({ x, y, id: 1 });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(y0)] });
    for (let i = 1; i <= 8; i += 1) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point(y0 - i * 22)] });
      await page.waitForTimeout(20);
    }
    await page.waitForTimeout(150);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
    await page.waitForTimeout(600);
    expect(await hasText(page, "EMPTY", "CampaignMarket")(), "the swipe added nothing to the cart").toBe(true);

    // Start with the receipt sheet open closes the sheet and stays on the Market.
    await focusStop(page, "CampaignMarket", "receipt");
    await press(page, A, async () => (await stopKeys(page, "CampaignMarket")).includes("receipt-close"));
    expect(await stopKeys(page, "CampaignMarket"), "the receipt is open").toContain("receipt-close");
    await press(page, START, async () => !(await stopKeys(page, "CampaignMarket")).includes("receipt-close"));
    expect(await stopKeys(page, "CampaignMarket"), "Start closed the receipt").not.toContain("receipt-close");
    expect(await sceneIs(page, "CampaignMarket")(), "and stayed on the Market").toBe(true);
    expect(errors).toEqual([]);
  });
});

test("the Market: X keeps only what the seat can afford, and X again shows the whole shelf", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackPageErrors(page);
  await openScreen(page, "screen=campaign-market&units=2", "CampaignMarket");
  await waitFor(hasText(page, "EMPTY", "CampaignMarket"), "the Market is stocked", 60_000);
  await page.waitForTimeout(1500);
  const cards = async (): Promise<number> =>
    (await stopKeys(page, "CampaignMarket")).filter((key) => key.startsWith("cart:")).length;
  const all = await cards();
  expect(all).toBeGreaterThan(8);
  await press(page, X, async () => (await cards()) !== all);
  const affordable = await cards();
  expect(affordable, "X hides the cards that cost more than 2 units").toBeLessThan(all);
  await page.waitForTimeout(800);
  for (let attempt = 0; attempt < 3 && (await cards()) !== all; attempt += 1) {
    await press(page, X, async () => (await cards()) === all);
    await page.waitForTimeout(500);
  }
  expect(await cards()).toBe(all);
  expect(errors).toEqual([]);
});

test("the Briefing: B closes the deck chooser first, then Start opens the issue", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openScreen(page, "screen=shadowland-dossier&view=briefing&unlock=all", "CampaignBriefing");
  await waitFor(
    async () => ((await stopKeys(page, "CampaignBriefing")).includes("open") ? true : null),
    "the issue is composed",
    60_000,
  );
  await page.waitForTimeout(1500);
  await focusStop(page, "CampaignBriefing", "edit-decks");
  await press(page, A, async () => (await stopKeys(page, "CampaignBriefing")).includes("pick-cancel"));
  expect(await stopKeys(page, "CampaignBriefing"), "the chooser is open").toContain("pick-cancel");
  await press(page, B, async () => !(await stopKeys(page, "CampaignBriefing")).includes("pick-cancel"));
  expect(await stopKeys(page, "CampaignBriefing"), "B closed the chooser").not.toContain("pick-cancel");
  expect(await sceneIs(page, "CampaignBriefing")(), "and stayed on the Briefing").toBe(true);
  await press(page, START, sceneGone(page, "CampaignBriefing"));
  await waitFor(sceneGone(page, "CampaignBriefing"), "Start opens the issue", 30_000);
  expect(errors).toEqual([]);
});

test("the in-game beat: Start, A, Y and View close it and never reach the table beneath", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackPageErrors(page);
  await installPad(page);
  await installWave6Helpers(page);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 3 });
  await declineMulligans(page);
  await settle(page, { quietMs: 600, maxMs: 5000 });
  await press(page, LT);
  await page.waitForTimeout(1500);
  const table = (): Promise<string> =>
    page.evaluate(async () => {
      const { appSession } = (await import("/src/session.ts")) as unknown as {
        appSession: () => { store: { state: { game?: unknown } } };
      };
      return JSON.stringify(appSession().store.state.game);
    });
  const before = await table();
  // The control: with no beat up, Start on the table opens Pause (so a press that reaches the table is visible).
  await press(page, START, sceneIs(page, "PauseOverlay"));
  expect(await sceneIs(page, "PauseOverlay")(), "Start reaches the table when no beat is up").toBe(true);
  await press(page, B, sceneGone(page, "PauseOverlay"));
  await waitFor(sceneGone(page, "PauseOverlay"), "B closes Pause", 10_000);
  const openBeat = async (): Promise<void> => {
    await page.evaluate(() =>
      (window as unknown as { __mcGame: { scene: { run: (k: string, d: unknown) => void } } }).__mcGame.scene.run(
        "CampaignBeatOverlay",
        {
          campaignId: "shadowland",
          nodeId: "shadows-in-the-night",
          stage: 2,
          round: 1,
          villainName: "Rhino",
          scenarioId: "rhino",
        },
      ),
    );
    await waitFor(sceneIs(page, "CampaignBeatOverlay"), "the beat is up", 10_000);
    await page.waitForTimeout(600);
  };
  // Each button closes the beat and the same press does nothing to the table: no Pause (Start), no recap or sheet.
  for (const [button, name] of [
    [START, "Start"],
    [A, "A"],
    [Y, "Y"],
    [VIEW, "View"],
  ] as const) {
    await openBeat();
    await press(page, button, sceneGone(page, "CampaignBeatOverlay"));
    await waitFor(sceneGone(page, "CampaignBeatOverlay"), `${name} closes the beat`, 10_000);
    await page.waitForTimeout(600);
    const scenes = await activeScenes(page);
    expect(scenes, `${name} reached the table`).not.toContain("PauseOverlay");
    expect(scenes, `${name} reached the table`).not.toContain("InspectOverlay");
    expect(scenes, `${name} reached the table`).not.toContain("VillainPhaseOverlay");
    expect(await table(), `${name} changed the table`).toBe(before);
  }
  expect(errors).toEqual([]);
});
