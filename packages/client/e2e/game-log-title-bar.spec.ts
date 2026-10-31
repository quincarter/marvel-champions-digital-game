import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickFocus, pressAt, settle, tapFocus, waitFor } from "./helpers.js";
import { continueRect, reachVillainRecap, villainDebugRect } from "./overlay-helpers.js";
import { answerChoiceSheet, installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { declineMulligans, hook, openApp, startGame, type Rect } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Issue #550: the game log left the table for the title bar. Its newest line runs there, cut with an ellipsis, and a
 * press of it, the log's key or a hold of View opens a larger view: beside the table on the long table, over the tab
 * area on a phone. A villain phase takes priority over an open log, and has its own way to the log and back.
 */

const tickerRect = (page: Page): Promise<Rect | null> => hook<Rect | null>(page, "__mcBoardDebug", "logTickerRect");
const logOpen = (page: Page): Promise<boolean | null> => hook<boolean>(page, "__mcBoardDebug", "logOpen");
const logRect = (page: Page): Promise<Rect | null> => hook<Rect | null>(page, "__mcBoardDebug", "logRect");

const press = async (page: Page, phone: boolean, rect: Rect): Promise<void> => {
  // A control drawn this frame takes presses from the next one: let the screen settle first.
  await settle(page);
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  if (phone) await page.touchscreen.tap(x, y);
  else await pressAt(page, x, y);
  await settle(page);
};

const logView = (page: Page): Promise<boolean> =>
  page.evaluate(
    () =>
      (
        window as unknown as { __mcVillainPhaseDebug?: { logView?: () => boolean } }
      ).__mcVillainPhaseDebug?.logView?.() ?? false,
  );

test("issue #550: the title bar's line opens the larger log, and its key does too", async ({ page }, info) => {
  test.setTimeout(150_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 3 });
  await declineMulligans(page);
  await settle(page);

  const ticker = await waitFor(() => tickerRect(page), "the log's line in the title bar", 15_000);
  expect(await logRect(page), "no log panel on the table").toBeNull();
  if (SHOT) await page.screenshot({ path: `${SHOT}/log-ticker-${info.project.name}.png` });

  await press(page, phone, ticker);
  expect(await logOpen(page), "a press of the line opens the log").toBe(true);
  const panel = (await logRect(page))!;
  expect(panel.width).toBeGreaterThan(phone ? 340 : 480);
  expect(panel.height).toBeGreaterThan(phone ? 280 : 700);
  if (SHOT) {
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOT}/log-open-${info.project.name}.png` });
  }

  await press(page, phone, ticker);
  expect(await logOpen(page), "a second press shuts it").toBe(false);

  if (!phone) {
    await page.keyboard.press("Shift+B");
    await settle(page);
    expect(await logOpen(page), "the log's key opens it").toBe(true);
    await page.keyboard.press("Escape");
    await settle(page);
    expect(await logOpen(page), "Escape shuts it").toBe(false);
  }
  expect(errors).toEqual([]);
});

test("issue #550: the villain phase goes to the log and back, and waits while the player reads", async ({
  page,
}, info) => {
  test.setTimeout(150_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      "mc-settings",
      JSON.stringify({ version: 1, villainAutoAdvance: "off", flipEncounterCards: false, holdEncounterCards: false }),
    ),
  );
  await installWave6Helpers(page);
  await page.goto("/?screen=villain-interrupt");
  const start = await waitFor(() => villainDebugRect(page, "startRect"), "START VILLAIN PHASE", 30_000);

  // The title bar's line works on every docked shape, and takes the phase's own panel: the phase is not closed.
  const ticker = await waitFor(() => tickerRect(page), "the log's line in the title bar", 15_000);
  await press(page, phone, ticker);
  expect(await logView(page), "the line opens the log inside the phase").toBe(true);
  expect(await logOpen(page), "the table's own log stays shut").toBe(false);
  if (SHOT) {
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOT}/log-in-villain-phase-${info.project.name}.png` });
  }

  const back = await waitFor(() => villainDebugRect(page, "logBackRect"), "the way back to the phase", 15_000);
  await press(page, phone, back);
  expect(await logView(page)).toBe(false);
  expect(await villainDebugRect(page, "startRect"), "back where the phase was").toEqual(start);

  if (!phone) {
    // The phase's own Log button, then Esc: Esc goes back to the phase and does not skip it.
    await page.keyboard.press("Shift+B");
    await settle(page);
    expect(await logView(page), "the log's key opens it in the phase").toBe(true);
    await page.keyboard.press("Escape");
    await settle(page);
    expect(await logView(page), "Escape goes back").toBe(false);
    expect(await villainDebugRect(page, "startRect"), "and the phase is still up").toEqual(start);
  }
  expect(errors).toEqual([]);
});

test("issue #550: a villain phase takes priority over an open log", async ({ page }, info) => {
  test.setTimeout(150_000);
  const phone = info.project.name === "phone";
  await page.addInitScript(() =>
    localStorage.setItem(
      "mc-settings",
      JSON.stringify({ version: 1, villainAutoAdvance: "off", flipEncounterCards: false, holdEncounterCards: false }),
    ),
  );
  await installWave6Helpers(page);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 3 });
  await declineMulligans(page);
  await settle(page);
  const ticker = await waitFor(() => tickerRect(page), "the log's line in the title bar", 15_000);
  await press(page, phone, ticker);
  expect(await logOpen(page)).toBe(true);

  await (phone ? tapFocus : clickFocus)(page, "basic:endTurn");
  await waitFor(
    async () => {
      const scenes = await activeScenes(page);
      // The end of turn's optional discard.
      if (scenes.includes("ChoiceOverlay") && !(await villainDebugRect(page, "startRect"))) {
        await answerChoiceSheet(page);
        return null;
      }
      if (scenes.includes("EndTurnConfirmOverlay")) {
        const rect = await hook<Rect>(page, "__mcEndTurnConfirmDebug", "endRect");
        if (rect) await press(page, phone, rect);
        return null;
      }
      return villainDebugRect(page, "startRect");
    },
    "the phase comes up over the log",
    30_000,
  );
  expect(await logOpen(page), "the log shut for the phase").toBe(false);
  expect(await logView(page), "the phase shows, not the log").toBe(false);
});

const revealed = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          __mcGame: { scene: { getScene(k: string): { debugState(): { revealed: number } } } };
        }
      ).__mcGame.scene
        .getScene("VillainPhaseOverlay")
        .debugState().revealed,
  );

const gated = (page: Page): Promise<void> =>
  page.addInitScript(() =>
    localStorage.setItem(
      "mc-settings",
      JSON.stringify({ version: 1, villainAutoAdvance: "off", flipEncounterCards: false, holdEncounterCards: false }),
    ),
  );

test.describe("with motion on", () => {
  test.use({ reducedMotion: "no-preference" });

  test("issue #550: nothing plays past a player reading the log", async ({ page }, info) => {
    test.setTimeout(150_000);
    const phone = info.project.name === "phone";
    await gated(page);
    await installWave6Helpers(page);
    await page.goto("/?screen=villain-interrupt");
    const start = await waitFor(() => villainDebugRect(page, "startRect"), "START VILLAIN PHASE", 30_000);
    const ticker = await waitFor(() => tickerRect(page), "the log's line in the title bar", 15_000);
    await page.waitForTimeout(600);
    if (phone) await page.touchscreen.tap(start.x + start.width / 2, start.y + start.height / 2);
    else await page.mouse.click(start.x + start.width / 2, start.y + start.height / 2);
    await page.waitForTimeout(100);
    if (phone) await page.touchscreen.tap(ticker.x + ticker.width / 2, ticker.y + ticker.height / 2);
    else await page.mouse.click(ticker.x + ticker.width / 2, ticker.y + ticker.height / 2);
    await waitFor(() => logView(page), "the log in the phase", 15_000);
    const at = await revealed(page);
    await page.waitForTimeout(3000);
    expect(await revealed(page), "the phase waits while the log is open").toBe(at);

    const back = (await villainDebugRect(page, "logBackRect"))!;
    await press(page, phone, back);
    await waitFor(() => villainDebugRect(page, "resolveRect"), "the phase carries on to its interrupt", 30_000);
  });
});

test("issue #550: a decision left for the log waits, and the sheet stays down until the player is back", async ({
  page,
}, info) => {
  test.setTimeout(150_000);
  const phone = info.project.name === "phone";
  await gated(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=villain-interrupt");
  await press(page, phone, await waitFor(() => villainDebugRect(page, "startRect"), "START", 30_000));
  const resolve = await waitFor(() => villainDebugRect(page, "resolveRect"), "the interrupt window", 15_000);

  const ticker = (await tickerRect(page))!;
  await press(page, phone, ticker);
  expect(await logView(page)).toBe(true);
  await press(page, phone, (await villainDebugRect(page, "logBackRect"))!);
  expect(await villainDebugRect(page, "resolveRect"), "the same window, unanswered").toEqual(resolve);
});

test("issue #550: the recap's Full log opens the log in place, and Back returns to the recap", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  await gated(page);
  await installWave6Helpers(page);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 3 });
  await declineMulligans(page);
  await settle(page);
  await reachVillainRecap(page, phone);
  const stops = await page.evaluate(() =>
    (window as unknown as { __mcFocusRoutes: Record<string, () => { key: string; rect: Rect }[]> }).__mcFocusRoutes[
      "VillainPhaseOverlay"
    ]!(),
  );
  await press(page, phone, stops.find((stop) => stop.key === "full-log")!.rect);
  expect(await logView(page), "Full log opens the log here, not Pause").toBe(true);
  expect(await activeScenes(page)).not.toContain("PauseOverlay");
  await press(page, phone, (await villainDebugRect(page, "logBackRect"))!);
  expect(await logView(page)).toBe(false);
  expect(await continueRect(page), "back on the recap").toBeTruthy();
});

test("issue #227: a swipe of the log that lifts on Close or the title bar's line leaves the log open", async ({
  page,
}, info) => {
  test.setTimeout(150_000);
  test.skip(info.project.name !== "phone", "a phone's touch sequence");
  await installWave6Helpers(page);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 3 });
  await declineMulligans(page);
  await settle(page);
  const ticker = await waitFor(() => tickerRect(page), "the log's line in the title bar", 15_000);
  await press(page, true, ticker);
  const panel = (await logRect(page))!;
  const from = { x: panel.x + panel.width / 2, y: panel.y + panel.height - 40 };
  const close = { x: panel.x + panel.width - 80, y: panel.y + 25 };
  for (const to of [close, { x: ticker.x + ticker.width / 2, y: ticker.y + ticker.height / 2 }]) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
    for (let i = 1; i <= 10; i++) {
      const point = { x: from.x + ((to.x - from.x) * i) / 10, y: from.y + ((to.y - from.y) * i) / 10 };
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...point, id: 1 }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
    await settle(page);
    expect(await logOpen(page), "a swipe that lifted over a control presses nothing").toBe(true);
  }
});

for (const [name, viewport] of [
  ["tablet landscape", { width: 1024, height: 768 }],
  ["tablet portrait", { width: 768, height: 1024 }],
] as const) {
  test.describe(name, () => {
    test.use({ viewport });

    test(`issue #550: the log opens from the title bar on a ${name}, and from the villain phase`, async ({
      page,
    }, info) => {
      test.skip(info.project.name !== "desktop", "a viewport of its own");
      test.setTimeout(150_000);
      await page.addInitScript(() =>
        localStorage.setItem(
          "mc-settings",
          JSON.stringify({
            version: 1,
            villainAutoAdvance: "off",
            flipEncounterCards: false,
            holdEncounterCards: false,
          }),
        ),
      );
      const slug = name.replace(" ", "-");
      await installWave6Helpers(page);
      await page.goto("/?screen=villain-interrupt");
      await waitFor(() => villainDebugRect(page, "startRect"), "START VILLAIN PHASE", 30_000);
      await settle(page);
      if (SHOT) await page.screenshot({ path: `${SHOT}/log-villain-button-${slug}.png` });
      const stops = await page.evaluate(() =>
        (window as unknown as { __mcFocusRoutes: Record<string, () => { key: string; rect: Rect }[]> }).__mcFocusRoutes[
          "VillainPhaseOverlay"
        ]!(),
      );
      const log = stops.find((stop) => stop.key === "log");
      expect(log, "the phase has its own Log button").toBeTruthy();
      await press(page, false, log!.rect);
      expect(await logView(page)).toBe(true);
      await page.waitForTimeout(400);
      if (SHOT) await page.screenshot({ path: `${SHOT}/log-in-villain-phase-${slug}.png` });
      await press(page, false, (await villainDebugRect(page, "logBackRect"))!);
      expect(await logView(page)).toBe(false);
    });

    test(`issue #550: the table shows the log's line on a ${name}`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "a viewport of its own");
      test.setTimeout(150_000);
      const slug = name.replace(" ", "-");
      await installWave6Helpers(page);
      await openApp(page);
      await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 3 });
      await declineMulligans(page);
      await settle(page);
      const ticker = await waitFor(() => tickerRect(page), "the log's line in the title bar", 15_000);
      expect(ticker.width).toBeGreaterThan(150);
      await press(page, false, ticker);
      expect(await logOpen(page)).toBe(true);
      await page.waitForTimeout(400);
      if (SHOT) await page.screenshot({ path: `${SHOT}/log-open-${slug}.png` });
    });
  });
}
