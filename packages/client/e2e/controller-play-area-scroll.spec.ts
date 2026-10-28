import { expect, test, type Page } from "@playwright/test";
import { settle } from "./helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { declineMulligans, hook, openApp, startGame } from "./wave6-helpers-b.js";
import { shot } from "./wave7-screens-helpers.js";

/**
 * A board full of supports and allies, played with a controller alone (a Discord report, 2026-10-28): the play area row
 * scrolls sideways, but a card scrolled wholly off it had no rect for the D-pad to step onto, and the right stick only
 * moved the row while focus was already on one of its cards. Left and right now walk the whole row, scrolling each card
 * in, and a sideways push of the right stick scrolls the row from anywhere on the table.
 */

const PAD_ID = "Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)";
const UP = 12;
const LEFT = 14;
const RIGHT = 15;
const RIGHT_STICK_X = 2;

async function installPad(page: Page): Promise<void> {
  await page.addInitScript((id) => {
    const pad = {
      connected: true,
      id,
      index: 0,
      mapping: "standard",
      timestamp: 0,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
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

/** Waits for `count` drawn frames, so the game has stepped over what the page just changed. */
const frames = (page: Page, count: number): Promise<void> =>
  page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        let seen = 0;
        const tick = (): void => {
          seen += 1;
          if (seen >= n) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    count,
  );

async function setButton(page: Page, index: number, down: boolean): Promise<void> {
  await page.evaluate(
    ([i, on]) => {
      const pad = (window as unknown as { __fakePad: { buttons: unknown[] } }).__fakePad;
      pad.buttons[i as number] = { pressed: on as boolean, touched: on as boolean, value: on ? 1 : 0 };
    },
    [index, down] as const,
  );
}

/** One press of a pad button: down until the page reads it and the game has stepped, then up and stepped again. */
async function padTap(page: Page, index: number): Promise<void> {
  await setButton(page, index, true);
  await page.waitForFunction((i) => navigator.getGamepads()[0]?.buttons[i]?.pressed === true, index);
  await frames(page, 8);
  await setButton(page, index, false);
  await page.waitForFunction((i) => navigator.getGamepads()[0]?.buttons[i]?.pressed === false, index);
  await frames(page, 8);
}

async function setAxis(page: Page, index: number, value: number): Promise<void> {
  await page.evaluate(
    ([i, v]) => {
      (window as unknown as { __fakePad: { axes: number[] } }).__fakePad.axes[i as number] = v as number;
    },
    [index, value] as const,
  );
}

const board = <T>(page: Page, method: string, ...args: unknown[]): Promise<T | null> =>
  hook<T>(page, "__mcBoardDebug", method, ...args);
const focusedKey = (page: Page): Promise<string | null> => board<string>(page, "focusedKey");
const scrollOf = async (page: Page): Promise<{ scrollX: number; maxScroll: number }> =>
  (await board<{ scrollX: number; maxScroll: number }>(page, "playAreaScroll"))!;

/** Presses `button` until focus reads `wanted`, at most `limit` times; returns the focus keys passed on the way. */
async function stepUntil(page: Page, button: number, wanted: RegExp, limit: number): Promise<string[]> {
  const seen: string[] = [];
  for (let i = 0; i < limit; i++) {
    const key = await focusedKey(page);
    if (key && wanted.test(key)) return seen;
    await padTap(page, button);
    seen.push((await focusedKey(page)) ?? "none");
  }
  return seen;
}

test("a controller walks and scrolls a full play area row", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "the pad on a desktop table; the phone's play area is its own tab");
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await installPad(page);
  await installWave6Helpers(page);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 3 });
  await declineMulligans(page);
  await settle(page, { quietMs: 1000, maxMs: 6000 });
  await board(page, "setBoardPad", { playArea: 13 });
  await settle(page);
  expect((await scrollOf(page)).maxScroll, "thirteen cards run past the row").toBeGreaterThan(0);

  // Up from the hand onto the identity, right into the row, then right along it: every card, the last ones scrolled in
  // from off the edge.
  const identity = await page.evaluate(() =>
    String(
      (
        window as unknown as { __mcBoardDebug: { tableGame(): { players: { identity: { instanceId: string } }[] } } }
      ).__mcBoardDebug.tableGame().players[0]!.identity.instanceId,
    ),
  );
  const up = await stepUntil(page, UP, new RegExp(`^card:${identity}$`), 3);
  expect(await focusedKey(page), `up from the hand reaches the identity (${up.join(", ")})`).toBe(`card:${identity}`);
  await padTap(page, RIGHT);
  expect(await focusedKey(page), "right from the identity enters the row").toBe("card:padp-0");
  const right = await stepUntil(page, RIGHT, /^card:padp-12$/, 14);
  expect(right, "right steps through every card in order").toEqual(
    Array.from({ length: 12 }, (_unused, index) => `card:padp-${index + 1}`),
  );
  const end = await scrollOf(page);
  expect(end.scrollX, "the row scrolled to its last card").toBeCloseTo(end.maxScroll, 0);
  await shot(page, "pad-play-area-end");

  // And back to the first card, scrolling the row back to its start.
  const left = await stepUntil(page, LEFT, /^card:padp-0$/, 14);
  expect(left.at(-1)).toBe("card:padp-0");
  expect((await scrollOf(page)).scrollX).toBe(0);

  // Focus off the row (up onto the villain side): a sideways push of the right stick still scrolls it.
  await stepUntil(page, UP, /^(?!card:padp-)/, 3);
  expect(await focusedKey(page)).not.toMatch(/^card:padp-/);
  await setAxis(page, RIGHT_STICK_X, 1);
  await page.waitForFunction(
    () =>
      ((
        window as unknown as { __mcBoardDebug: { playAreaScroll(): { scrollX: number } } }
      ).__mcBoardDebug.playAreaScroll().scrollX ?? 0) > 100,
    null,
    { timeout: 10_000 },
  );
  await setAxis(page, RIGHT_STICK_X, 0);
  await frames(page, 4);
  expect((await scrollOf(page)).scrollX, "the stick scrolled the row").toBeGreaterThan(100);
  await shot(page, "pad-play-area-stick");
  expect(errors).toEqual([]);
});
