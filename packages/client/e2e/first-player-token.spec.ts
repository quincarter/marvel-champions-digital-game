import { expect, test, type Page } from "@playwright/test";
import { pressHookStop, trackPageErrors, waitFor } from "./helpers.js";

/**
 * The first player token (the owner, 2026-10-16): on Set the table it sits on the first player's seat in place of the
 * radio dot and flies to a newly picked seat; on the board it sits on the first player's identity and flies to the
 * next one when it passes. Toss is the default; Reduced motion places it without the flight.
 */

// This spec is about the flight itself, so motion is back on (the suite runs reduced; `playwright.config.ts`).
test.use({ reducedMotion: "no-preference" });

interface TokenSample {
  readonly x: number;
  readonly y: number;
}

const setupToken = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          __mcTableSetupDebug?: {
            firstPlayerToken: () => { index: number; x: number; y: number; at: TokenSample } | null;
          };
        }
      ).__mcTableSetupDebug?.firstPlayerToken() ?? null,
  );

type BoardHook = {
  firstPlayerToken: () => { holder: string | null; flyingTo: string | null; x: number; y: number } | null;
  seatIds: () => string[];
  passFirstPlayerToken: (id: string) => void;
};
const boardToken = (page: Page) =>
  page.evaluate(() => (window as unknown as { __mcBoardDebug?: BoardHook }).__mcBoardDebug?.firstPlayerToken() ?? null);

/**
 * Records the token every animation frame inside the page, from now until `stop` reads them back: sampled through
 * `page.evaluate` one call at a time, a flight of under a second can slip between two round trips.
 */
async function startSampling(page: Page, hook: "__mcTableSetupDebug" | "__mcBoardDebug"): Promise<void> {
  await page.evaluate((name) => {
    const w = window as unknown as Record<string, unknown> & { __fptSamples: unknown[] };
    w.__fptSamples = [];
    const tick = (): void => {
      const read = (w[name] as { firstPlayerToken?: () => unknown } | undefined)?.firstPlayerToken?.();
      if (read) w.__fptSamples.push(read);
      if (w.__fptSamples.length < 600) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, hook);
}

const samples = <T>(page: Page): Promise<T[]> =>
  page.evaluate(() => (window as unknown as { __fptSamples: unknown[] }).__fptSamples) as Promise<T[]>;

test("Set the table: the token sits on the first player and is tossed to a new one", async ({ page }) => {
  test.setTimeout(60_000);
  const errors = trackPageErrors(page);
  await page.goto("/?screen=table-setup&players=3");
  const start = await waitFor(() => setupToken(page), "the token on seat 1", 30_000);
  expect(start.index).toBe(0);

  await startSampling(page, "__mcTableSetupDebug");
  await pressHookStop(page, "__mcTableSetupDebug", "first-player:2");
  await page.waitForTimeout(1500);
  const flight = await samples<{ index: number; x: number; y: number; at: TokenSample }>(page);
  const landed = flight[flight.length - 1]!;
  expect(landed).toMatchObject({ index: 2 });
  expect(landed.x).toBeCloseTo(landed.at.x, 0);
  expect(landed.y).toBeCloseTo(landed.at.y, 0);
  // A toss rises above the row on the way over.
  expect(Math.min(...flight.map((s) => s.y))).toBeLessThan(landed.at.y - 40);
  expect(errors).toEqual([]);
});

test("Reduced motion places the token without a flight", async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() =>
    localStorage.setItem("mc-settings", JSON.stringify({ version: 1, reducedMotion: true })),
  );
  await page.goto("/?screen=table-setup&players=3");
  await waitFor(() => setupToken(page), "the token on seat 1", 30_000);
  await startSampling(page, "__mcTableSetupDebug");
  await pressHookStop(page, "__mcTableSetupDebug", "first-player:1");
  await page.waitForTimeout(600);
  const flight = await samples<{ index: number; x: number; y: number; at: TokenSample }>(page);
  expect(flight.some((s) => s.index === 1)).toBe(true);
  for (const s of flight) {
    if (s.index !== 1) continue;
    expect(s.x).toBeCloseTo(s.at.x, 0);
    expect(s.y).toBeCloseTo(s.at.y, 0);
  }
});

test("the board: the token rests on the first player and flies to the next one", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = trackPageErrors(page);
  await page.goto("/?screen=alliance");
  const first = await waitFor(() => boardToken(page), "the board's token", 45_000);
  const seats = await page.evaluate(() =>
    (window as unknown as { __mcBoardDebug: BoardHook }).__mcBoardDebug.seatIds(),
  );
  expect(seats.length).toBe(2);
  expect(first.holder).not.toBeNull();
  const next = seats.find((id) => id !== first.holder)!;

  await startSampling(page, "__mcBoardDebug");
  await page.evaluate(
    (id) => (window as unknown as { __mcBoardDebug: BoardHook }).__mcBoardDebug.passFirstPlayerToken(id),
    next,
  );
  await page.waitForTimeout(1600);
  const flight = await samples<{ flyingTo: string | null }>(page);
  expect(flight.some((s) => s.flyingTo === next)).toBe(true);
  const landed = await waitFor(
    async () => {
      const s = await boardToken(page);
      return s && s.holder === next && s.flyingTo === null ? s : null;
    },
    "the token landed on the next first player",
    5_000,
  );
  expect(Math.hypot(landed.x - first.x, landed.y - first.y)).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});
