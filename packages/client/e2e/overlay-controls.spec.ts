import { expect, test, type Page } from "@playwright/test";
import {
  activeScenes,
  guideStopped,
  hasText,
  isSceneUp,
  pressUntil,
  settle,
  startTutorialFromTitle,
  trackPageErrors,
  waitFor,
} from "./helpers.js";
import { continueRect, gameMarks, reachVillainRecap, villainDebugRect } from "./overlay-helpers.js";
import { installWave6Helpers, routeStops } from "./wave6-helpers-a.js";
import { SHOT } from "./x-men-helpers.js";
import { declineMulligans, openApp, startGame, type Rect } from "./wave6-helpers-b.js";

/**
 * Every control on the overlays that lay a full-screen pointer shield over the table (Pause, the villain-phase recap,
 * the round debrief) answers a real press. A shield that sits over the overlay's own buttons leaves the whole sheet dead
 * and nothing else notices: the Pause menu's Stop tutorial, Resume and the rest stopped answering while every spec
 * that clicked "by text" still passed, because the press fell through to a control behind the sheet. So each press here
 * is aimed at the control's own rect (read from the scene's focus route), a mouse click on desktop and a touch tap on
 * the phone, and the effect is read from durable state (a scene up or gone, a setting flipped, the guide stopped).
 */

const DECK = "core-spider-man-justice";
const PAUSE = "PauseOverlay";

const isPhone = (info: { project: { name: string } }): boolean => info.project.name === "phone";

async function touchOrClick(page: Page, phone: boolean, x: number, y: number): Promise<void> {
  if (phone) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** One finger pressed at (x, fromY), dragged straight to toY in small steps, and lifted there. */
async function touchSwipe(page: Page, x: number, fromY: number, toY: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: fromY }] });
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    await page.waitForTimeout(16);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: fromY + ((toY - fromY) * i) / steps }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

const stopOf = async (page: Page, scene: string, key: string): Promise<Rect | null> =>
  (await routeStops(page, scene))?.stops.find((s) => s.key === key)?.rect ?? null;

/** Presses a named control of `scene` (aimed at its rect, after the screen settles) until `reached` holds. */
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

const sceneUp = (page: Page, scene: string) => async (): Promise<boolean> => isSceneUp(page, scene);
const sceneGone = (page: Page, scene: string) => async (): Promise<boolean> => !(await isSceneUp(page, scene));
const stopShown = (page: Page, scene: string, key: string) => async (): Promise<boolean> =>
  (await stopOf(page, scene, key)) !== null;

const settingsJson = (page: Page): Promise<string> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { settings: unknown };
    };
    return JSON.stringify(appSession().settings);
  });

/** Opens Pause with the board's own top-right menu control (MENU on desktop, the hamburger on a phone). */
async function openPause(page: Page, phone: boolean): Promise<void> {
  const width = page.viewportSize()!.width;
  await pressUntil(
    page,
    () => touchOrClick(page, phone, width - 35, 22),
    sceneUp(page, PAUSE),
    "the menu control opens Pause",
  );
  await settle(page);
}

async function newGame(page: Page): Promise<void> {
  await installWave6Helpers(page);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: [DECK], seed: 3 });
  await declineMulligans(page);
  await settle(page);
}

/** Settings rows, flipped once and flipped back: each press must change the saved setting. */
async function flipRows(page: Page, phone: boolean, scene: string, keyOf: (id: string) => string): Promise<void> {
  // The phone's lower group scrolls and draws only the rows on screen; flip the ones that are there.
  let flipped = 0;
  const size = page.viewportSize()!;
  for (const id of ["reduced-motion", "large-card-text", "confirm-end-turn", "same-name-conflict"]) {
    // A row's rect keeps its scrolled position under the phone's footer buttons; only a row clear of them is a target.
    // Card size sits above the toggles on the phone's sheet, so a row just under the fold is scrolled up into view.
    const clear = (r: Rect | null): boolean => r !== null && r.y + r.height / 2 <= size.height - 150;
    let rect = await stopOf(page, scene, keyOf(id));
    for (let i = 0; i < 3 && rect && !clear(rect); i++) {
      if (phone) await touchSwipe(page, 60, size.height - 200, size.height - 330);
      else {
        await page.mouse.move(size.width / 2, size.height / 2);
        await page.mouse.wheel(0, 120);
      }
      await settle(page, { quietMs: 150, maxMs: 600 });
      rect = await stopOf(page, scene, keyOf(id));
    }
    if (!clear(rect)) continue;
    const before = await settingsJson(page);
    await pressStop(page, phone, scene, keyOf(id), async () => (await settingsJson(page)) !== before);
    await pressStop(page, phone, scene, keyOf(id), async () => (await settingsJson(page)) === before);
    flipped++;
  }
  expect(flipped, "at least two settings rows were on screen and flipped").toBeGreaterThanOrEqual(2);
}

test.describe("Pause menu", () => {
  test("Resume, the log, Rules reference, Settings and Concede's Cancel answer a real press", async ({
    page,
  }, info) => {
    // About fifteen presses, each a verified click with its own read-back and settle. The CI runner answers every page
    // call in 0.7 to 3 s (software WebGL, two pages on four cores), so a press costs 10 s there and this walk 150 s+.
    test.setTimeout(360_000);
    const phone = isPhone(info);
    const errors = trackPageErrors(page);
    await newGame(page);
    await openPause(page, phone);

    if (phone) {
      // The phone's own sheet: a Quick reference row opens Rules reference; the Table rows are toggles.
      const quick = (await routeStops(page, PAUSE))!.stops.find((s) => s.key.startsWith("quick:"));
      expect(quick, "Pause lists a Quick reference row").toBeDefined();
      await pressStop(page, phone, PAUSE, quick!.key, sceneUp(page, "RulesOverlay"));
      await pressStop(page, phone, "RulesOverlay", "back", sceneGone(page, "RulesOverlay"));
      await flipRows(page, phone, PAUSE, (id) => `table:${id}`);
    } else {
      await pressStop(page, phone, PAUSE, "full-game-log", () => hasText(page, "Every retained beat", PAUSE));
      await pressStop(
        page,
        phone,
        PAUSE,
        "full-game-log",
        async () => !(await hasText(page, "Every retained beat", PAUSE)),
      );
      await pressStop(page, phone, PAUSE, "rules-reference", sceneUp(page, "RulesOverlay"));
      await pressStop(page, phone, "RulesOverlay", "back", sceneGone(page, "RulesOverlay"));
      await pressStop(page, phone, PAUSE, "settings", sceneUp(page, "SettingsOverlay"));
      await flipRows(page, phone, "SettingsOverlay", (id) => `row:${id}`);
      await pressStop(page, phone, "SettingsOverlay", "back", sceneGone(page, "SettingsOverlay"));
    }

    // Concede asks first; Cancel puts the menu back with the game untouched.
    const marks = await gameMarks(page);
    await pressStop(page, phone, PAUSE, "concede", stopShown(page, PAUSE, "concede-confirm-cancel"));
    await pressStop(page, phone, PAUSE, "concede-confirm-cancel", stopShown(page, PAUSE, "concede"));
    expect(await gameMarks(page), "Cancel left the game alone").toEqual(marks);

    await pressStop(page, phone, PAUSE, "resume", sceneGone(page, PAUSE));
    expect(await activeScenes(page)).toContain("Board");
    expect(errors).toEqual([]);
  });

  test("Save & quit leaves for the title", async ({ page }, info) => {
    test.setTimeout(120_000);
    const phone = isPhone(info);
    await newGame(page);
    await openPause(page, phone);
    await pressStop(page, phone, PAUSE, "save-quit", async () => (await activeScenes(page)).includes("Title"));
    expect(await activeScenes(page)).not.toContain("Board");
  });

  test("the phone's ✕ still closes Pause with the Table and Guide rows scrolled to the bottom", async ({
    page,
  }, info) => {
    test.skip(!isPhone(info), "the scrolling Table and Guide group is the phone sheet's own");
    test.setTimeout(180_000);
    const errors = trackPageErrors(page);
    await newGame(page);
    await openPause(page, true);
    const size = page.viewportSize()!;
    // Scrolled to the foot of the group, the rows above the fold sit (masked, unseen) over the title bar and its ✕.
    for (let i = 0; i < 8; i++) {
      await touchSwipe(page, 60, size.height - 200, size.height - 420);
      await settle(page, { quietMs: 150, maxMs: 600 });
    }
    const close = (await stopOf(page, PAUSE, "close"))!;
    // A swipe of the rows that lifts over the ✕ is a scroll, not a press (issue #227).
    await touchSwipe(page, close.x + close.width / 2, size.height - 220, close.y + close.height / 2);
    await settle(page);
    expect(await isSceneUp(page, PAUSE), "a swipe that lifted on the ✕ left Pause open").toBe(true);
    if (SHOT) await page.screenshot({ path: `${SHOT}/pause-scrolled-${info.project.name}.png` });
    // One tap, no retries: a scrolled-out row that still caught the press left the ✕ dead.
    await page.touchscreen.tap(close.x + close.width / 2, close.y + close.height / 2);
    await waitFor(sceneGone(page, PAUSE), "a tap on the ✕ closes Pause", 5_000);
    expect(errors).toEqual([]);
  });

  test("the phone's Game log row shows the log, and a swipe that lifts over a row doesn't open it", async ({
    page,
  }, info) => {
    test.skip(!isPhone(info), "the Quick reference rows and the Game log row are the phone sheet's own");
    test.setTimeout(180_000);
    await newGame(page);
    await openPause(page, true);

    // A finger that presses one row, scrolls past the tap slop and lifts over the next row is a scroll, not a tap.
    const from = (await stopOf(page, PAUSE, "quick:villainPhase"))!;
    const to = (await stopOf(page, PAUSE, "quick:glossary"))!;
    await touchSwipe(page, from.x + from.width / 2, from.y + from.height / 2, to.y + to.height / 2);
    await settle(page);
    expect(await activeScenes(page), "a swipe opened nothing").not.toContain("RulesOverlay");

    await pressStop(page, true, PAUSE, "quick:jumpLog", () => hasText(page, "Round 1 begins", PAUSE));
    await pressStop(page, true, PAUSE, "quick:jumpLog", async () => !(await hasText(page, "Round 1 begins", PAUSE)));
  });

  test("the phone's sheet sets Card size in place, and Show all settings opens the full Settings screen", async ({
    page,
  }, info) => {
    test.skip(!isPhone(info), "the Quick reference rows are the phone sheet's own; wide mode's menu has Settings");
    test.setTimeout(120_000);
    await newGame(page);
    await openPause(page, true);
    const cardSize = (): Promise<string> =>
      page.evaluate(async () => {
        const { appSession } = (await import("/src/session.ts")) as unknown as {
          appSession: () => { settings: { cardSize: string } };
        };
        return appSession().settings.cardSize;
      });
    await pressStop(page, true, PAUSE, "table:card-size:large", async () => (await cardSize()) === "large");
    await pressStop(page, true, PAUSE, "quick:settings", async () =>
      (await activeScenes(page)).includes("SettingsOverlay"),
    );
  });

  test("Concede, confirmed, ends the game for the table", async ({ page }, info) => {
    test.setTimeout(120_000);
    const phone = isPhone(info);
    await newGame(page);
    await openPause(page, phone);
    const before = await gameMarks(page);
    await pressStop(page, phone, PAUSE, "concede", stopShown(page, PAUSE, "concede-confirm-yes"));
    await pressStop(
      page,
      phone,
      PAUSE,
      "concede-confirm-yes",
      async () => (await gameMarks(page)).version !== before.version,
    );
    await waitFor(
      async () => ((await isSceneUp(page, PAUSE)) ? null : true),
      "Pause closes after a confirmed concede",
      20_000,
    );
  });

  test("Concede while the villain phase waits for START goes on to Game Over", async ({ page }, info) => {
    // Regression: the unstarted phase reveals no beats, so it held the concession's Game Over forever, leaving the
    // pause menu reading DEFEAT over a round that never ended.
    test.setTimeout(120_000);
    const phone = isPhone(info);
    const errors = trackPageErrors(page);
    await page.addInitScript(() =>
      localStorage.setItem(
        "mc-settings",
        JSON.stringify({ version: 1, villainAutoAdvance: "off", flipEncounterCards: false, holdEncounterCards: false }),
      ),
    );
    await installWave6Helpers(page);
    await page.goto("/?screen=villain-interrupt");
    await waitFor(() => villainDebugRect(page, "startRect"), "START VILLAIN PHASE", 30_000);
    await openPause(page, phone);
    await pressStop(page, phone, PAUSE, "concede", stopShown(page, PAUSE, "concede-confirm-yes"));
    await pressStop(page, phone, PAUSE, "concede-confirm-yes", sceneGone(page, PAUSE));
    await waitFor(
      async () => ((await isSceneUp(page, "GameOver")) ? true : null),
      "Game Over comes up after conceding over the unstarted villain phase",
      20_000,
    );
    expect(await isSceneUp(page, "VillainPhaseOverlay")).toBe(false);
    expect(errors).toEqual([]);
  });
});

test.describe("Pause menu during a guided run (the Guide rail is showing)", () => {
  test.beforeEach(async ({ page: _page }, info) => {
    // The phone's tabbed board has its own guide strip and the tutorial walk is not driven there (playwright.config.ts).
    test.skip(isPhone(info), "the guided walk is not driven on the phone board");
  });

  test("Resume, Stop tutorial and Turn guide off all answer", async ({ page }) => {
    test.setTimeout(240_000);
    await installWave6Helpers(page);
    await page.goto("/");
    await startTutorialFromTitle(page);
    await openPause(page, false);
    await pressStop(page, false, PAUSE, "resume", sceneGone(page, PAUSE));

    await openPause(page, false);
    expect((await routeStops(page, PAUSE))!.stops.map((s) => s.key)).toContain("guide-stop-tutorial");
    await pressStop(page, false, PAUSE, "guide-stop-tutorial", () => guideStopped(page));
    await pressStop(page, false, PAUSE, "resume", sceneGone(page, PAUSE));
  });

  test("Turn guide off stops the run", async ({ page }) => {
    test.setTimeout(240_000);
    await installWave6Helpers(page);
    await page.goto("/");
    await startTutorialFromTitle(page);
    await openPause(page, false);
    await pressStop(page, false, PAUSE, "guide-turn-guide-off", () => guideStopped(page));
  });
});

test.describe("Villain-phase recap", () => {
  test("Continue closes the recap on the last step", async ({ page }, info) => {
    test.setTimeout(150_000);
    const phone = isPhone(info);
    await newGame(page);
    await reachVillainRecap(page, phone);
    const rect = (await continueRect(page))!;
    await pressUntil(
      page,
      () => touchOrClick(page, phone, rect.x + rect.width / 2, rect.y + rect.height / 2),
      sceneGone(page, "VillainPhaseOverlay"),
      "Continue closes the recap",
    );
  });

  test("Skip closes the recap", async ({ page }, info) => {
    test.setTimeout(150_000);
    const phone = isPhone(info);
    await newGame(page);
    await reachVillainRecap(page, phone);
    // The recap is docked beside the table (EXPAND); Hide is on the full-screen recap it opens.
    const expand = await villainDebugRect(page, "expandRect");
    expect(expand, "the docked recap draws EXPAND").not.toBeNull();
    await touchOrClick(page, phone, expand!.x + expand!.width / 2, expand!.y + expand!.height / 2);
    await waitFor(
      async () => ((await villainDebugRect(page, "expandRect")) ? null : true),
      "the full-screen recap",
      10_000,
    );
    const skip = await page.evaluate(
      () =>
        (
          window as unknown as { __mcVillainPhaseDebug?: { skipRect(): Rect | null } }
        ).__mcVillainPhaseDebug?.skipRect() ?? null,
    );
    expect(skip, "the recap draws a Skip control").not.toBeNull();
    await pressUntil(
      page,
      () => touchOrClick(page, phone, skip!.x + skip!.width / 2, skip!.y + skip!.height / 2),
      sceneGone(page, "VillainPhaseOverlay"),
      "Skip closes the recap",
    );
  });
});

test.describe("Round debrief", () => {
  test("Replay a lesson and the next-round control answer a real press", async ({ page }, info) => {
    test.setTimeout(120_000);
    const phone = isPhone(info);
    await installWave6Helpers(page);
    await openApp(page, "screen=debrief", { landing: "RoundDebriefOverlay" });
    await settle(page);
    const keys = (await routeStops(page, "RoundDebriefOverlay"))!.stops.map((s) => s.key);
    expect(keys).toEqual(expect.arrayContaining(["replay-lesson", "next-round"]));

    // The guide level segments are toggles, too: pressing "Off" leaves the sheet up and saves the level.
    const levelKey = keys.find((k) => /off/i.test(k));
    if (levelKey) {
      await pressStop(page, phone, "RoundDebriefOverlay", levelKey, async () => {
        const level = await page.evaluate(() => JSON.parse(localStorage.getItem("mc-guide") ?? "{}").level);
        return level === "off";
      });
    }
    await pressStop(page, phone, "RoundDebriefOverlay", "next-round", sceneGone(page, "RoundDebriefOverlay"));
  });
});
