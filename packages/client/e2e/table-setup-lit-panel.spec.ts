import { expect, test, type Page } from "@playwright/test";
import { pressHookStop, settle, trackPageErrors, waitFor } from "./helpers.js";
import { hook, type Rect } from "./wave6-helpers-b.js";

/**
 * Set up the table as Lit panels over the canvas: the sections change the draft through their controls, the first
 * player token is its own panel placed from the seat's rect, and on a phone the end of a swipe never presses what the
 * finger lifts over (issue #227): the page scrolls natively and the Deal button sits under it, not over it.
 */

const HOOK = "__mcTableSetupDebug";
interface Stop extends Rect {
  readonly key: string;
}

const stops = async (page: Page): Promise<Stop[]> => (await hook<Stop[]>(page, HOOK, "stops")) ?? [];
const stopOf = async (page: Page, key: string): Promise<Stop | null> =>
  (await stops(page)).find((s) => s.key === key) ?? null;
const centre = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

async function open(page: Page, players = 2): Promise<void> {
  await page.goto(`/?screen=table-setup&players=${players}`);
  await waitFor(() => stopOf(page, "deal-it-out"), "the deal button", 30_000);
  await settle(page);
}

test("the difficulty, the modular picks and the first player change the draft through their sections", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = trackPageErrors(page);
  await open(page);
  // The seat chips first: on a phone Expert adds a row, which pushes them down the page.
  expect(await hook<number | null>(page, HOOK, "firstPlayer")).toBe(0);
  await pressHookStop(page, HOOK, "first-player:1");
  await waitFor(
    async () => ((await hook<number | null>(page, HOOK, "firstPlayer")) === 1 ? true : null),
    "seat 2 first",
    5000,
  );
  expect(await hook<string>(page, HOOK, "difficulty")).toBe("standard");
  await pressHookStop(page, HOOK, "difficulty:expert");
  await waitFor(
    async () => ((await hook<string>(page, HOOK, "difficulty")) === "expert" ? true : null),
    "expert",
    5000,
  );
  expect(errors).toEqual([]);
});

test("the first player token ends on the new seat's spot, and is no control", async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() =>
    localStorage.setItem("mc-settings", JSON.stringify({ version: 1, reducedMotion: false })),
  );
  await open(page, 3);
  type Token = { index: number; x: number; y: number; at: { x: number; y: number }; flying: boolean };
  const token = () => hook<Token | null>(page, HOOK, "firstPlayerToken");
  const start = await waitFor(token, "the token on seat 1", 15_000);
  expect(start.index).toBe(0);

  await pressHookStop(page, HOOK, "first-player:2");
  // It rests on the third seat, inside that seat's own control, and has stopped flying.
  const landed = await waitFor(
    async () => {
      const t = await token();
      return t && t.index === 2 && !t.flying ? t : null;
    },
    "the token resting on seat 3",
    10_000,
  );
  const seat = (await stopOf(page, "first-player:2"))!;
  expect(landed.x).toBeGreaterThan(seat.x);
  expect(landed.x).toBeLessThan(seat.x + seat.width);
  expect(landed.y).toBeGreaterThan(seat.y);
  expect(landed.y).toBeLessThan(seat.y + seat.height);
  expect(landed.x).toBeCloseTo(landed.at.x, 0);

  // A press where the token rests reaches the seat under it (the token takes no press).
  await pressHookStop(page, HOOK, "first-player:1");
  await waitFor(
    async () => ((await hook<number | null>(page, HOOK, "firstPlayer")) === 1 ? true : null),
    "seat 2 first",
    5000,
  );
  const pointer = await page.evaluate(
    ([x, y]) => {
      const el = document.elementFromPoint(x!, y!);
      return el?.closest("mc-first-player-token") ? "token" : "other";
    },
    [landed.at.x, landed.at.y] as const,
  );
  expect(pointer).toBe("other");
});

test("a swipe of the page that lifts on a control presses nothing", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "a touch swipe");
  test.setTimeout(90_000);
  await open(page);
  const before = {
    difficulty: await hook<string>(page, HOOK, "difficulty"),
    picks: await hook<string[]>(page, HOOK, "picks"),
    first: await hook<number | null>(page, HOOK, "firstPlayer"),
  };
  const cdp = await page.context().newCDPSession(page);
  const swipe = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
    for (let i = 1; i <= 8; i++)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: from.x + ((to.x - from.x) * i) / 8, y: from.y + ((to.y - from.y) * i) / 8, id: 1 }],
      });
    await page.waitForTimeout(150);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  // Down on a difficulty segment, dragged up the page and lifted over the Deal button; then down on a seat chip's row.
  const expert = centre((await stopOf(page, "difficulty:expert"))!);
  const deal = centre((await stopOf(page, "deal-it-out"))!);
  await swipe(expert, { x: expert.x, y: deal.y - 4 });
  await swipe(deal, expert);
  await settle(page);
  await cdp.detach();
  expect(await hook<string>(page, HOOK, "difficulty")).toBe(before.difficulty);
  expect(await hook<string[]>(page, HOOK, "picks")).toEqual(before.picks);
  expect(await hook<number | null>(page, HOOK, "firstPlayer")).toBe(before.first);
  // Still on Set up the table: the Deal button was not pressed.
  expect(await stopOf(page, "deal-it-out")).not.toBeNull();
});
