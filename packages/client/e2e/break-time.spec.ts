import { expect, test, type Page } from "@playwright/test";
import { activeScenes, focusRect, handInstanceFor, pressUntil, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, visibleTexts } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOT, bringIntoView, boardUp, facts, payWith, playFromHand, press } from "./x-men-helpers.js";

/**
 * Deadpool's Break Time (44046) asks "How many minutes were you away?" (docs/phase7-wave7.md §3.83), a `reportFact`
 * choice with no options. The choice sheet answers it with a stepper (view/report-fact-entry.ts). The dev game
 * (`store/dev-break-time-game.ts`) is a real game played forward to Deadpool in alter-ego form with Break Time in hand;
 * the play, its payment and the answer are real pointer or touch input.
 */

const BREAK_TIME = "44046";

const choiceRect = (page: Page, key: string): Promise<{ x: number; y: number; width: number; height: number } | null> =>
  page.evaluate((k) => {
    const debug = (window as unknown as { __mcChoiceDebug?: { allRects(): [string, unknown][] } }).__mcChoiceDebug;
    const found = debug?.allRects().find(([key]) => key === k);
    return (found?.[1] as { x: number; y: number; width: number; height: number } | undefined) ?? null;
  }, key);

const pressChoice = async (page: Page, phone: boolean, key: string): Promise<void> => {
  const rect = await waitFor(() => choiceRect(page, key), `the sheet's "${key}" control`, 10000);
  await press(page, phone, rect.x + rect.width / 2, rect.y + rect.height / 2);
  await settle(page, { quietMs: 150, maxMs: 600 });
};

const sheetTexts = async (page: Page): Promise<string[]> =>
  (await visibleTexts(page)).filter((t) => t.scene === "ChoiceOverlay").map((t) => t.text);

const stepperValue = async (page: Page): Promise<number | null> => {
  for (const text of await sheetTexts(page)) {
    const m = /^(\d+) min$/i.exec(text.trim());
    if (m) return Number(m[1]);
  }
  return null;
};

/** Starts the dev game, plays Break Time and pays, and waits for the minutes-away question. */
async function openBreakQuestion(page: Page, phone: boolean, shot: string): Promise<void> {
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: unknown } };
    const { startBreakTimeDevGame } = (await import(
      /* @vite-ignore */ "/src/store/dev-break-time-game.ts"
    )) as unknown as {
      startBreakTimeDevGame: (store: unknown) => Promise<void>;
    };
    await startBreakTimeDevGame(appSession().store);
    const scenes = (
      window as unknown as {
        __mcGame: {
          scene: {
            getScenes: (a: boolean) => { sys: { settings: { key: string } } }[];
            stop: (k: string) => void;
            start: (k: string) => void;
          };
        };
      }
    ).__mcGame.scene;
    for (const s of scenes.getScenes(true)) scenes.stop(s.sys.settings.key);
    scenes.start("Board");
  });
  await boardUp(page);

  const card = (await handInstanceFor(page, BREAK_TIME))!;
  expect(card, "Break Time is in Deadpool's hand").not.toBeNull();
  const others = await facts(page, (game) => game.players[0].hand.slice() as string[]);
  const filler = others.filter((id) => id !== card).slice(0, 3);

  const asked = async (): Promise<boolean> =>
    (await sheetTexts(page)).some((t) => /on a break|how many minutes/i.test(t));
  await playFromHand(page, phone, card, async () => (await asked()) || (await payOpen(page)));
  if (!(await asked())) {
    await payWith(page, phone, filler);
  }
  await waitFor(async () => ((await asked()) ? true : null), "the break screen", 15000);
  await settle(page, { quietMs: 400, maxMs: 4000 });
  if (SHOT) await page.screenshot({ path: `${SHOT}/${shot}.png` });
}

const reportedMinutes = (page: Page): Promise<(number | undefined)[]> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: { state: { commandTrail: { events: { type: string; amount?: number }[] }[] } };
      };
    };
    return appSession()
      .store.state.commandTrail.flatMap((entry) => entry.events)
      .filter((event) => event.type === "factReported")
      .map((event) => event.amount);
  });

const continuesPastQuestion = async (page: Page): Promise<void> => {
  await waitFor(
    async () =>
      (await facts(page, (game) => game.pendingChoice === null || game.pendingChoice === undefined)) ? true : null,
    "the game continues past the question",
    15000,
  );
  expect(
    await facts(page, (game) => game.players[0].discard.some((id: string) => game.instances[id].cardId === "44046")),
    "Break Time is played and discarded",
  ).toBe(true);
};

test("Break Time: the break timer counts wall-clock time and End break reports the whole minutes", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const phone = info.project.name === "phone";
  // The fake clock keeps running with real time; fastForward jumps wall time the way a suspended laptop does.
  await page.clock.install();
  await openBreakQuestion(page, phone, `break-timer-${info.project.name}-start`);
  const texts = await sheetTexts(page);
  expect(
    texts.some((t) => /^End break, /i.test(t.trim())),
    "End break names the player's hero",
  ).toBe(true);
  expect(
    texts.some((t) => /enter minutes instead/i.test(t)),
    "the manual path is offered",
  ).toBe(true);
  expect(await stepperValue(page), "the stepper is not the default").toBeNull();

  await page.clock.fastForward("03:20");
  await settle(page, { quietMs: 400, maxMs: 3000 });
  // Wall time between the prompt opening and this read also counts (that is the point), so on a slow machine the
  // clock may have passed 3:59: read the minutes off the clock and hold the heal line and the report to them.
  const later = await sheetTexts(page);
  const clock = later.map((t) => /^(\d+):[0-5]\d$/.exec(t.trim())).find((m) => m !== null);
  expect(clock, "the clock shows minutes and seconds").toBeTruthy();
  const minutes = Number(clock![1]);
  expect(minutes, "at least the 3 minutes jumped").toBeGreaterThanOrEqual(3);
  expect(
    later.some((t) => new RegExp(`^Heal ${minutes} from each identity$`, "i").test(t.trim())),
    "the heal line is the whole minutes so far",
  ).toBe(true);
  if (SHOT) await page.screenshot({ path: `${SHOT}/break-timer-${info.project.name}-3m20.png` });

  await pressChoice(page, phone, "confirm");
  await continuesPastQuestion(page);
  const reported = await reportedMinutes(page);
  expect(reported, "one report").toHaveLength(1);
  // A minute boundary can pass between the read and the press.
  expect([minutes, minutes + 1], "the engine was told the whole minutes on the clock").toContain(reported[0]);
});

test("Break Time: Enter minutes instead opens the stepper, and the game continues", async ({ page }, info) => {
  test.setTimeout(240_000);
  const phone = info.project.name === "phone";
  await openBreakQuestion(page, phone, `break-timer-${info.project.name}-manual-start`);
  await pressChoice(page, phone, "report:manual");
  await waitFor(async () => ((await stepperValue(page)) === null ? null : true), "the stepper", 10000);
  if (SHOT) await page.screenshot({ path: `${SHOT}/break-time-${info.project.name}.png` });

  // The stepper starts at 0, where minus has nothing to take.
  expect(await stepperValue(page), "starts at 0 min").toBe(0);
  await pressChoice(page, phone, "report:set:30");
  expect(await stepperValue(page), "a quick pick sets 30").toBe(30);
  await pressChoice(page, phone, "report:minus");
  await pressChoice(page, phone, "report:minus");
  await pressChoice(page, phone, "report:plus");
  expect(await stepperValue(page), "minus, minus, plus makes 29").toBe(29);
  if (SHOT) await page.screenshot({ path: `${SHOT}/break-time-${info.project.name}-29.png` });

  await pressChoice(page, phone, "confirm");
  await continuesPastQuestion(page);
  expect(await reportedMinutes(page), "the engine was told 29 minutes").toEqual([29]);
});

/**
 * Inspect on Break Time (3 per player) in a two-player game: the scaled price leads ("6"), the printed rate explains it
 * ("3 per player", "× 2 players"), and Play carries the price. The design frames are 08B, L06B and 14B.
 */
test("Break Time's Inspect shows 3 per player × 2 players as 6", async ({ page }, info) => {
  test.setTimeout(120_000);
  const phone = info.project.name === "phone";
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: unknown } };
    const { startBreakTimeDevGame } = (await import(
      /* @vite-ignore */ "/src/store/dev-break-time-game.ts"
    )) as unknown as { startBreakTimeDevGame: (store: unknown, players: number) => Promise<void> };
    await startBreakTimeDevGame(appSession().store, 2);
    const scenes = (
      window as unknown as {
        __mcGame: {
          scene: {
            getScenes: (a: boolean) => { sys: { settings: { key: string } } }[];
            stop: (k: string) => void;
            start: (k: string) => void;
          };
        };
      }
    ).__mcGame.scene;
    for (const s of scenes.getScenes(true)) scenes.stop(s.sys.settings.key);
    scenes.start("Board");
  });
  await boardUp(page);
  const card = (await handInstanceFor(page, BREAK_TIME))!;
  expect(card, "Break Time is in Deadpool's hand").not.toBeNull();
  await bringIntoView(page, `card:${card}`);
  const rect = (await focusRect(page, `card:${card}`))!;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const inspectOpen = async (): Promise<boolean> => (await activeScenes(page)).includes("InspectOverlay");
  await pressUntil(
    page,
    () => (phone ? page.touchscreen.tap(cx, cy) : page.mouse.click(cx, cy, { button: "right" })),
    inspectOpen,
    "Inspect opens",
    { minWaitMs: 3000 },
  );
  await settle(page, { quietMs: 400, maxMs: 2000 });
  const texts = (await visibleTexts(page)).filter((t) => t.scene === "InspectOverlay").map((t) => t.text.trim());
  const lower = texts.map((t) => t.toLowerCase().replace(/\s+/g, " "));
  expect(lower, "the badge leads with the scaled price").toContain("6");
  expect(
    lower.some((t) => t.includes("3 per player")),
    "the printed rate",
  ).toBe(true);
  expect(lower, "the player count").toContain("× 2 players");
  expect(
    lower.some((t) => /^play( it)?$/.test(t)) && lower.filter((t) => t === "6").length >= 2,
    "Play carries the price",
  ).toBe(true);
  if (SHOT) await page.screenshot({ path: `${SHOT}/per-player-cost-${info.project.name}.png` });
});

const payOpen = async (page: Page): Promise<boolean> =>
  (await visibleTexts(page)).some((t) => t.scene === "Board" && /^pay$/i.test(t.text));
